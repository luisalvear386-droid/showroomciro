import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Perfil } from './auth'
import type { CajaActual } from './caja'
import type { ProductoListado } from './productos'
import type { ItemCarrito, MedioPago } from './ventas'

/**
 * Base local del mostrador (IndexedDB vía Dexie), para vender sin conexión (Módulo 11,
 * design.md → "Modo Offline-First"). Nada de acá es la fuente de verdad: es la última copia
 * conocida de lo que dijo Supabase, más la cola de ventas que todavía no llegaron.
 *
 * Nunca se guardan costos (`productos_costos`): el catálogo del POS no los trae.
 */

/** Una venta hecha en el mostrador que todavía no se registró en Supabase. */
export interface VentaPendiente {
  /** = `p_venta_id` de `registrar_venta()`: reintentar con el mismo id nunca duplica la venta. */
  id: string
  caja_id: string
  /** Quién la hizo: solo se sincroniza con ese usuario logueado (`registrar_venta()` usa auth.uid()). */
  usuario_id: string
  medio_pago: MedioPago
  /** Copia del carrito: para el ticket offline, la lista de errores y el stock local. */
  items: ItemCarrito[]
  /** Total cobrado con los precios del catálogo local (para avisar si la base registra otro). */
  total_cobrado: number
  /** Hora del mostrador en que se hizo la venta (ISO) → `p_fecha`. */
  creada_en: string
  /** Las sincronizadas se borran de la cola: acá solo quedan pendientes o con error. */
  estado: 'pendiente' | 'con_error'
  intentos: number
  ultimo_error?: { codigo: string; mensaje: string }
}

/** Datos sueltos de una sola fila cada uno, por clave. */
type Estado =
  /** Última caja conocida. null = el servidor confirmó que no había caja abierta. */
  | { clave: 'caja'; caja: CajaActual | null; guardada_en: string }
  /** Cuándo se bajó por última vez el catálogo completo. */
  | { clave: 'catalogo'; actualizado_en: string }

class BaseLocal extends Dexie {
  // `declare`: Dexie crea las tablas en `stores()`; un campo de clase normal las pisaría
  declare productos: EntityTable<ProductoListado, 'id'>
  declare perfiles: EntityTable<Perfil, 'id'>
  declare estado: Table<Estado, Estado['clave']>
  declare ventasPendientes: EntityTable<VentaPendiente, 'id'>

  constructor() {
    super('showroomciro')
    // Solo se indexa lo que se consulta: el resto de cada objeto se guarda igual
    this.version(1).stores({
      productos: 'id',
      perfiles: 'id',
      estado: 'clave',
      ventasPendientes: 'id, estado, usuario_id, creada_en',
    })
  }
}

export const db = new BaseLocal()

// ---------------------------------------------------------------------------
// Catálogo del POS
// ---------------------------------------------------------------------------

/** Reemplaza el catálogo entero en una transacción: nunca queda a medio escribir. */
export async function guardarCatalogo(productos: ProductoListado[]): Promise<void> {
  await db.transaction('rw', db.productos, db.estado, async () => {
    await db.productos.clear()
    await db.productos.bulkPut(productos)
    await db.estado.put({ clave: 'catalogo', actualizado_en: new Date().toISOString() })
  })
}

// ---------------------------------------------------------------------------
// Caché de perfil y caja
// ---------------------------------------------------------------------------
// Es un respaldo para arrancar sin conexión: si IndexedDB no está disponible (navegador en
// modo privado, sin espacio) la app sigue funcionando online, así que los errores se tragan.

function avisar(accion: string, error: unknown): void {
  console.warn(`Base local: no se pudo ${accion}.`, error)
}

export async function guardarPerfil(perfil: Perfil): Promise<void> {
  try {
    await db.perfiles.put(perfil)
  } catch (error) {
    avisar('guardar el perfil', error)
  }
}

export async function leerPerfilGuardado(id: string): Promise<Perfil | undefined> {
  try {
    return await db.perfiles.get(id)
  } catch (error) {
    avisar('leer el perfil', error)
    return undefined
  }
}

export async function borrarPerfilGuardado(id: string): Promise<void> {
  try {
    await db.perfiles.delete(id)
  } catch (error) {
    avisar('borrar el perfil', error)
  }
}

export async function guardarCaja(caja: CajaActual | null): Promise<void> {
  try {
    await db.estado.put({ clave: 'caja', caja, guardada_en: new Date().toISOString() })
  } catch (error) {
    avisar('guardar la caja', error)
  }
}

/** Última caja conocida; undefined si nunca se guardó ninguna (o no se pudo leer). */
export async function leerCajaGuardada(): Promise<CajaActual | null | undefined> {
  try {
    const fila = await db.estado.get('caja')
    return fila?.clave === 'caja' ? fila.caja : undefined
  } catch (error) {
    avisar('leer la caja', error)
    return undefined
  }
}
