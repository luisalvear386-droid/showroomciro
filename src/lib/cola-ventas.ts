import { refrescarCatalogo } from './catalogo-local'
import { db, type VentaPendiente } from './db-local'
import { supabase } from './supabase'
import {
  esErrorDeSesion,
  esErrorTransitorio,
  mensajeErrorVenta,
  obtenerItemsVenta,
  registrarVenta,
  type PedidoVenta,
  type VentaRegistrada,
} from './ventas'

/**
 * Cola de ventas del mostrador (Módulo 11). Toda venta se guarda primero en la base local y
 * recién después se envía: si se corta la conexión a mitad de camino, la venta no se pierde.
 * Una venta sale de la cola cuando la base la registra, o cuando la rechaza con el cliente
 * todavía en el mostrador (el error se muestra en el checkout, como sin cola).
 */

/** Cuánto se espera la respuesta de la venta antes de dejarla pendiente. */
const TIMEOUT_VENTA_MS = 10000

export function pedidoDe(venta: VentaPendiente): PedidoVenta {
  return {
    id: venta.id,
    caja_id: venta.caja_id,
    medio_pago: venta.medio_pago,
    items: venta.items.map((i) => ({ variante_id: i.variante_id, cantidad: i.cantidad })),
    fecha: venta.creada_en,
  }
}

/** La venta armada con los datos del mostrador, para la confirmación y el ticket offline. */
export function ventaLocal(venta: VentaPendiente): VentaRegistrada {
  return {
    venta: { id: venta.id, fecha: venta.creada_en, total: venta.total_cobrado, medio_pago: venta.medio_pago },
    items: venta.items.map((i) => ({ variante_id: i.variante_id, cantidad: i.cantidad, precio_unitario: i.precio })),
  }
}

async function quitarDeCola(id: string): Promise<void> {
  try {
    await db.ventasPendientes.delete(id)
  } catch (error) {
    console.warn('Base local: no se pudo sacar la venta de la cola.', error)
  }
}

export type ResultadoVenta =
  /** La base la registró: ticket con sus precios. */
  | { tipo: 'registrada'; registrada: VentaRegistrada }
  /** Quedó en la cola para sincronizar: ticket con los datos del mostrador. */
  | { tipo: 'pendiente'; registrada: VentaRegistrada }
  /** La base la rechazó (sin stock, caja cerrada…): ya no está en la cola. */
  | { tipo: 'rechazada'; error: unknown }

/**
 * Vende desde el mostrador: encola y envía enseguida. Queda pendiente (sin enviarla) si:
 * - `sesionOffline`: no hay token válido, el envío saldría rechazado como no autenticado;
 * - hay ventas anteriores de este usuario en la cola: se sincronizan en orden (el stock lo
 *   descuentan en el orden en que se vendió).
 *
 * Si la base local no está disponible, se envía directo como antes del Módulo 11: una falla
 * de red se informa como rechazo, porque no hay dónde dejar la venta.
 */
export async function venderDesdeMostrador(
  venta: VentaPendiente,
  { sesionOffline }: { sesionOffline: boolean },
): Promise<ResultadoVenta> {
  let encolada = true
  let hayAnteriores = false
  try {
    await db.ventasPendientes.put(venta)
    // Las "con error" no cuentan: esperan que alguien las resuelva, no frenan las nuevas
    hayAnteriores =
      (await db.ventasPendientes
        .where('usuario_id')
        .equals(venta.usuario_id)
        .filter((v) => v.estado === 'pendiente' && v.id !== venta.id)
        .count()) > 0
  } catch (error) {
    console.warn('Base local: no se pudo encolar la venta, se envía directo.', error)
    encolada = false
  }

  if (encolada && (sesionOffline || hayAnteriores)) return { tipo: 'pendiente', registrada: ventaLocal(venta) }

  try {
    const registrada = await registrarVenta(pedidoDe(venta), { timeoutMs: TIMEOUT_VENTA_MS })
    if (encolada) await quitarDeCola(venta.id)
    void refrescarCatalogo().catch(() => undefined)

    // Si justo se corta al leer los ítems, el ticket sale con los precios del mostrador
    const items = await obtenerItemsVenta(venta.id).catch(() => ventaLocal(venta).items)
    return { tipo: 'registrada', registrada: { venta: registrada, items } }
  } catch (error) {
    if (encolada && esErrorTransitorio(error)) return { tipo: 'pendiente', registrada: ventaLocal(venta) }
    if (encolada) await quitarDeCola(venta.id)
    return { tipo: 'rechazada', error }
  }
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

/** En la sincronización no hay cliente esperando: se le da más margen a cada venta. */
const TIMEOUT_SINCRONIZACION_MS = 15000
const CANDADO = 'showroomciro-sincronizar-ventas'

export type ResultadoSincronizacion =
  /** No quedan ventas pendientes del usuario (puede haber quedado alguna con error). */
  | { estado: 'ok'; registradas: number; conError: number }
  /** Se cortó por un error de red: la venta que falló y las siguientes siguen pendientes. */
  | { estado: 'sin-conexion'; registradas: number; conError: number }
  /** Sin sesión válida de ese usuario: no se envió nada. */
  | { estado: 'sin-sesion'; registradas: number; conError: number }
  /**
   * La base rechazó la sesión (usuario inactivo, venta de otro usuario): esa venta queda
   * "con error" y se frena. No se reintenta sola: cada intento marcaría otra venta.
   */
  | { estado: 'sesion-rechazada'; registradas: number; conError: number }
  /** Otra sincronización (de esta pestaña o de otra) estaba en curso. */
  | { estado: 'ocupado' }

function describirError(error: unknown): { codigo: string; mensaje: string } {
  const codigo = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return { codigo: codigo || 'red', mensaje: mensajeErrorVenta(error) }
}

/**
 * Registra en orden (de la más vieja a la más nueva) las ventas pendientes del usuario:
 * - registrada: sale de la cola (si la base tomó otro total, queda en `ventasConDiferencia`);
 * - error de red: se corta ahí, para no desordenar el stock; se reintenta más tarde;
 * - error de sesión: queda "con error" y se corta (las siguientes fallarían igual);
 * - cualquier otro rechazo (sin stock, caja cerrada, variante inexistente): queda
 *   "con error" para resolverla a mano, y se sigue con la siguiente.
 */
async function sincronizar(usuarioId: string): Promise<ResultadoSincronizacion> {
  let registradas = 0
  let conError = 0

  // getSession() renueva el token si hace falta: así no se envía con uno vencido
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id !== usuarioId) return { estado: 'sin-sesion', registradas, conError }

  const pendientes = await db.ventasPendientes
    .where('usuario_id')
    .equals(usuarioId)
    .filter((v) => v.estado === 'pendiente')
    .sortBy('creada_en')

  try {
    for (const venta of pendientes) {
      try {
        const registrada = await registrarVenta(pedidoDe(venta), { timeoutMs: TIMEOUT_SINCRONIZACION_MS })
        await db.transaction('rw', db.ventasPendientes, db.ventasConDiferencia, async () => {
          await db.ventasPendientes.delete(venta.id)
          if (Math.abs(registrada.total - venta.total_cobrado) >= 0.01) {
            await db.ventasConDiferencia.put({
              id: venta.id,
              usuario_id: venta.usuario_id,
              creada_en: venta.creada_en,
              total_cobrado: venta.total_cobrado,
              total_registrado: registrada.total,
            })
          }
        })
        registradas++
      } catch (error) {
        const intento = { intentos: venta.intentos + 1, ultimo_error: describirError(error) }
        if (esErrorTransitorio(error)) {
          await db.ventasPendientes.update(venta.id, intento)
          return { estado: 'sin-conexion', registradas, conError }
        }
        await db.ventasPendientes.update(venta.id, { ...intento, estado: 'con_error' })
        conError++
        if (esErrorDeSesion(error)) return { estado: 'sesion-rechazada', registradas, conError }
      }
    }
    return { estado: 'ok', registradas, conError }
  } finally {
    // Con ventas nuevas en la base, el stock guardado quedó viejo
    if (registradas > 0) void refrescarCatalogo().catch(() => undefined)
  }
}

let sincronizandoSinCandado = false

/**
 * Sincroniza la cola del usuario, una sola vez a la vez entre todas las pestañas (Web Locks).
 * `esperar`: en vez de devolver "ocupado", espera a que termine la que está en curso y
 * vuelve a pasar (el cierre de caja necesita un resultado definitivo).
 */
export async function sincronizarCola(
  usuarioId: string,
  { esperar = false }: { esperar?: boolean } = {},
): Promise<ResultadoSincronizacion> {
  if ('locks' in navigator) {
    return navigator.locks.request(CANDADO, { ifAvailable: !esperar }, (candado) =>
      candado ? sincronizar(usuarioId) : { estado: 'ocupado' as const },
    )
  }
  // Navegador sin Web Locks: al menos no se pisan dos sincronizaciones de esta pestaña
  if (sincronizandoSinCandado) return { estado: 'ocupado' }
  sincronizandoSinCandado = true
  try {
    return await sincronizar(usuarioId)
  } finally {
    sincronizandoSinCandado = false
  }
}

// ---------------------------------------------------------------------------
// Ventas con error (se resuelven a mano)
// ---------------------------------------------------------------------------

/** Vuelve a poner en la cola una venta con error (ej. después de ajustar el stock). */
export async function reintentarVenta(id: string): Promise<void> {
  await db.ventasPendientes.update(id, { estado: 'pendiente' })
}

/** Saca de la cola una venta con error que en realidad no ocurrió. No se puede deshacer. */
export async function descartarVenta(id: string): Promise<void> {
  await db.ventasPendientes.delete(id)
}

/** Ventas del usuario que todavía no están en la base (pendientes o con error). */
export async function contarSinRegistrar(usuarioId: string): Promise<number> {
  return db.ventasPendientes.where('usuario_id').equals(usuarioId).count()
}

/**
 * Ventas de esa caja que todavía no están en la base, de cualquier usuario. Si se cerrara la
 * caja con alguna, quedaría fuera del monto esperado (y después la base la rechazaría).
 */
export async function ventasSinRegistrarDeCaja(cajaId: string): Promise<VentaPendiente[]> {
  return db.ventasPendientes.filter((v) => v.caja_id === cajaId).toArray()
}

/**
 * Por qué no se puede cerrar la caja todavía, o null si se puede. `usuarioId`: quien cierra
 * (solo puede sincronizar sus propias ventas).
 */
export function motivoBloqueoCierre(ventas: VentaPendiente[], usuarioId: string): string | null {
  const deOtros = ventas.filter((v) => v.usuario_id !== usuarioId).length
  const conError = ventas.filter((v) => v.usuario_id === usuarioId && v.estado === 'con_error').length
  const pendientes = ventas.length - deOtros - conError

  const plural = (n: number, singular: string, varias: string) => (n === 1 ? singular : varias)
  if (conError > 0) {
    return `Hay ${conError} ${plural(conError, 'venta que la base rechazó', 'ventas que la base rechazó')}: ${plural(conError, 'resolvela', 'resolvelas')} antes de cerrar la caja.`
  }
  if (pendientes > 0) {
    return `Hay ${pendientes} ${plural(pendientes, 'venta sin sincronizar', 'ventas sin sincronizar')}. Se ${plural(pendientes, 'registra sola', 'registran solas')} cuando vuelva la conexión; esperá a que termine para cerrar la caja.`
  }
  if (deOtros > 0) {
    return `Hay ${deOtros} ${plural(deOtros, 'venta de otro usuario sin sincronizar', 'ventas de otro usuario sin sincronizar')}: tiene que iniciar sesión en esta computadora para que se ${plural(deOtros, 'registre', 'registren')} antes de cerrar la caja.`
  }
  return null
}

/** Da por vista una venta que la base registró con otro total (deja de avisarse). */
export async function marcarDiferenciaVista(id: string): Promise<void> {
  await db.ventasConDiferencia.delete(id)
}
