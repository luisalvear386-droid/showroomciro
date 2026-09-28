import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta'

/** Fila de `ventas` tal como la devuelve `registrar_venta()`. */
export interface Venta {
  id: string
  fecha: string
  total: number
  medio_pago: MedioPago
}

export interface ItemVendido {
  variante_id: string
  cantidad: number
  /** Precio que tomó la base al registrar la venta (no el que mostraba el carrito). */
  precio_unitario: number
}

export interface VentaRegistrada {
  venta: Venta
  items: ItemVendido[]
}

/** Ítem del carrito del POS: una variante con los datos que muestran carrito, checkout y ticket. */
export interface ItemCarrito {
  variante_id: string
  producto_nombre: string
  foto_url: string | null
  talle: string
  color: string
  sku: string
  /** Precio del catálogo al agregarlo; el que vale es el que toma `registrar_venta()`. */
  precio: number
  cantidad: number
}

export const MEDIOS_PAGO: { medio: MedioPago; etiqueta: string; ayuda: string }[] = [
  { medio: 'efectivo', etiqueta: 'Efectivo', ayuda: 'Entra a caja' },
  { medio: 'transferencia', etiqueta: 'Transferencia', ayuda: 'QR o alias' },
  { medio: 'tarjeta', etiqueta: 'Tarjeta', ayuda: 'Débito o crédito' },
]

export interface ItemPedido {
  variante_id: string
  cantidad: number
}

export interface PedidoVenta {
  /** Generado en el cliente: reintentar con el mismo id nunca duplica la venta. */
  id: string
  caja_id: string
  medio_pago: MedioPago
  items: ItemPedido[]
  /** Hora en que se hizo la venta (ISO). Sin ella, la base usa la hora de llegada. */
  fecha?: string
}

/**
 * Registra la venta de forma atómica vía `registrar_venta()` (0008, 0012): inserta la venta
 * y sus ítems y descuenta stock en una sola transacción, con los precios actuales de la base.
 * Si ya estaba registrada (reintento), devuelve esa misma venta.
 *
 * `timeoutMs`: corta la espera (sin internet pero con red local, el pedido puede quedar
 * colgado). No hay riesgo de duplicar: si el pedido llegó igual, el reintento lo encuentra.
 */
export async function registrarVenta(pedido: PedidoVenta, { timeoutMs }: { timeoutMs?: number } = {}): Promise<Venta> {
  let consulta = supabase.rpc('registrar_venta', {
    p_venta_id: pedido.id,
    p_caja_id: pedido.caja_id,
    p_medio_pago: pedido.medio_pago,
    p_items: pedido.items,
    p_fecha: pedido.fecha ?? null,
  })
  if (timeoutMs !== undefined) consulta = consulta.abortSignal(AbortSignal.timeout(timeoutMs))
  const { data, error } = await consulta
  if (error) throw error

  const fila = data as Venta
  return { ...fila, total: Number(fila.total) }
}

/** Ítems de una venta registrada, con los precios que tomó la base (para el ticket). */
export async function obtenerItemsVenta(ventaId: string): Promise<ItemVendido[]> {
  const { data, error } = await supabase
    .from('venta_items')
    .select('variante_id, cantidad, precio_unitario')
    .eq('venta_id', ventaId)
  if (error) throw error
  return (data as ItemVendido[]).map((i) => ({ ...i, precio_unitario: Number(i.precio_unitario) }))
}

function esErrorPostgrest(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/** 57014 timeout de sentencia, 40001/40P01 conflicto de concurrencia, 53300 sin conexiones libres. */
const CODIGOS_TRANSITORIOS = new Set(['57014', '40001', '40P01', '53300'])

/**
 * true si la venta no llegó a una respuesta de la base: sin conexión, timeout o una falla
 * del servidor sin código. Esas ventas quedan en la cola y se reintentan con el mismo id.
 *
 * Los errores de la base traen siempre código (SQLSTATE, o PGRSTxxx de PostgREST); los de
 * red, postgrest-js los devuelve con código vacío. También son transitorios los de
 * conexión de PostgREST con la base (PGRST000–003) y los SQLSTATE de timeout, conflicto de
 * concurrencia o falta de conexiones.
 */
export function esErrorTransitorio(error: unknown): boolean {
  if (!esErrorPostgrest(error)) return true
  return error.code === '' || /^PGRST00[0-3]$/.test(error.code) || CODIGOS_TRANSITORIOS.has(error.code) || error.code.startsWith('08')
}

/**
 * true si el rechazo es por la sesión y no por la venta: usuario inactivo, venta de otro
 * usuario (42501) o JWT rechazado por PostgREST (PGRST301/302). Frena la cola entera: las
 * ventas siguientes fallarían igual.
 */
export function esErrorDeSesion(error: unknown): boolean {
  return esErrorPostgrest(error) && ['42501', 'PGRST301', 'PGRST302'].includes(error.code)
}

/** Errores de `registrar_venta()` cuyo mensaje ya está escrito para mostrarse en el POS. */
const CODIGOS_CON_MENSAJE = new Set(['23514', '22023', 'P0002'])

/** Traduce un error al registrar la venta a un mensaje para mostrar en el checkout. */
export function mensajeErrorVenta(error: unknown): string {
  if (esErrorPostgrest(error)) {
    if (CODIGOS_CON_MENSAJE.has(error.code)) return error.message
    if (error.code === '42501') return 'No tenés permiso para registrar ventas.'
  }
  return 'No se pudo registrar la venta. Revisá la conexión e intentá de nuevo.'
}

/** true si la venta falló por falta de stock (conviene recargar el catálogo). */
export function esErrorSinStock(error: unknown): boolean {
  return esErrorPostgrest(error) && error.code === '23514'
}
