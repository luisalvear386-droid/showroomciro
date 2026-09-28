import { refrescarCatalogo } from './catalogo-local'
import { db, type VentaPendiente } from './db-local'
import { esErrorTransitorio, obtenerItemsVenta, registrarVenta, type PedidoVenta, type VentaRegistrada } from './ventas'

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
    hayAnteriores = (await db.ventasPendientes.where('usuario_id').equals(venta.usuario_id).count()) > 1
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
