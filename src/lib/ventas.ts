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

/**
 * Registra la venta de forma atómica vía `registrar_venta()` (0008): inserta la venta y
 * sus ítems y descuenta stock en una sola transacción, con los precios actuales de la base.
 *
 * `ventaId` lo genera el cliente: reintentar con el mismo id nunca duplica la venta
 * (la función devuelve la ya registrada). Después lee los ítems para el ticket.
 */
export async function registrarVenta(
  ventaId: string,
  cajaId: string,
  medioPago: MedioPago,
  items: ItemPedido[],
): Promise<VentaRegistrada> {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_venta_id: ventaId,
    p_caja_id: cajaId,
    p_medio_pago: medioPago,
    p_items: items,
  })
  if (error) throw error

  const fila = data as Venta
  const venta: Venta = { ...fila, total: Number(fila.total) }

  const { data: filasItems, error: errorItems } = await supabase
    .from('venta_items')
    .select('variante_id, cantidad, precio_unitario')
    .eq('venta_id', ventaId)
  if (errorItems) throw errorItems

  return {
    venta,
    items: (filasItems as ItemVendido[]).map((i) => ({ ...i, precio_unitario: Number(i.precio_unitario) })),
  }
}

function esErrorPostgrest(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
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
