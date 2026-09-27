import { supabase } from './supabase'

/** Fila de `caja_actual_resumen()`. No incluye montos de efectivo: el cierre es a conteo ciego. */
export interface CajaActual {
  caja_id: string
  fecha_apertura: string
  cantidad_ventas: number
  total_vendido: number
}

/** Caja abierta en este momento (la haya abierto quien sea), o null si no hay ninguna. */
export async function obtenerCajaActual(): Promise<CajaActual | null> {
  const { data, error } = await supabase.rpc('caja_actual_resumen')
  if (error) throw error

  const filas = (data ?? []) as CajaActual[]
  const fila = filas[0]
  if (!fila) return null

  // numeric llega como number o string según el tamaño: se normaliza
  return {
    ...fila,
    cantidad_ventas: Number(fila.cantidad_ventas),
    total_vendido: Number(fila.total_vendido),
  }
}

export type ResultadoApertura = { ok: true } | { ok: false; error: string; yaAbierta?: boolean }

/**
 * Abre la caja con el monto inicial. `usuario_apertura_id` lo completa el default auth.uid()
 * y la policy `cajas_insert` exige que no venga ningún dato de cierre.
 */
export async function abrirCaja(montoInicial: number): Promise<ResultadoApertura> {
  const { error } = await supabase.from('cajas').insert({ monto_inicial: montoInicial })
  if (!error) return { ok: true }

  // uq_cajas_una_abierta: otro usuario la abrió mientras se completaba el formulario
  if (error.code === '23505') {
    return { ok: false, yaAbierta: true, error: 'La caja ya fue abierta por otro usuario.' }
  }
  return { ok: false, error: 'No se pudo abrir la caja. Revisá la conexión e intentá de nuevo.' }
}
