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

export type ResultadoCierre = { ok: true } | { ok: false; error: string }

/**
 * Cierra la caja vía la RPC `cerrar_caja()` (única vía: no hay UPDATE directo sobre `cajas`).
 * La función calcula monto_esperado y diferencia del lado de la base.
 */
export async function cerrarCaja(cajaId: string, montoContado: number): Promise<ResultadoCierre> {
  const { error } = await supabase.rpc('cerrar_caja', { caja_id: cajaId, monto_contado: montoContado })
  if (!error) return { ok: true }

  if (error.code === '22023' && error.message.includes('ya fue cerrada')) {
    return { ok: false, error: 'Esta caja ya fue cerrada por otro usuario.' }
  }
  if (error.code === '22023') return { ok: false, error: 'Ingresá un monto contado válido.' }
  if (error.code === 'P0002') return { ok: false, error: 'La caja ya no existe. Recargá la página.' }
  if (error.code === '42501') return { ok: false, error: 'No tenés permiso para cerrar la caja.' }
  return { ok: false, error: 'No se pudo cerrar la caja. Revisá la conexión e intentá de nuevo.' }
}

export interface VentasPorMedio {
  efectivo: number
  transferencia: number
  tarjeta: number
}

/** Una jornada cerrada del Historial de Caja. */
export interface JornadaCaja {
  id: string
  fecha_apertura: string
  fecha_cierre: string
  abrio: string
  cerro: string
  monto_inicial: number
  monto_esperado: number
  monto_contado: number
  diferencia: number
  cantidad_ventas: number
  ventas_por_medio: VentasPorMedio
}

interface FilaHistorial {
  id: string
  fecha_apertura: string
  fecha_cierre: string
  monto_inicial: number | string
  monto_esperado: number | string
  monto_contado: number | string
  diferencia: number | string
  abrio: { nombre_usuario: string } | null
  cerro: { nombre_usuario: string } | null
  ventas: { medio_pago: keyof VentasPorMedio; total: number | string }[]
}

/**
 * Cajas cerradas cuya apertura cae entre `desde` y `hasta` (fechas locales 'YYYY-MM-DD',
 * ambas inclusive; vacía = sin límite), de la más reciente a la más vieja.
 *
 * Pensado para el Dueño/a: el RLS del Vendedor no le deja ver cajas ni nombres de otros
 * usuarios, ni ventas de cajas ya cerradas.
 */
export async function obtenerHistorialCajas(desde: string, hasta: string): Promise<JornadaCaja[]> {
  let consulta = supabase
    .from('cajas')
    .select(
      'id, fecha_apertura, fecha_cierre, monto_inicial, monto_esperado, monto_contado, diferencia, ' +
        'abrio:perfiles!cajas_usuario_apertura_id_fkey(nombre_usuario), ' +
        'cerro:perfiles!cajas_usuario_cierre_id_fkey(nombre_usuario), ' +
        'ventas(medio_pago, total)',
    )
    .not('fecha_cierre', 'is', null)

  // Los límites van como instantes: medianoche local del día, no de UTC
  if (desde) {
    const [anio, mes, dia] = desde.split('-').map(Number)
    consulta = consulta.gte('fecha_apertura', new Date(anio, mes - 1, dia).toISOString())
  }
  if (hasta) {
    const [anio, mes, dia] = hasta.split('-').map(Number)
    consulta = consulta.lt('fecha_apertura', new Date(anio, mes - 1, dia + 1).toISOString())
  }

  const { data, error } = await consulta.order('fecha_apertura', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as FilaHistorial[]).map((fila) => {
    const ventas_por_medio: VentasPorMedio = { efectivo: 0, transferencia: 0, tarjeta: 0 }
    for (const venta of fila.ventas) ventas_por_medio[venta.medio_pago] += Number(venta.total)

    // numeric llega como number o string según el tamaño: se normaliza
    return {
      id: fila.id,
      fecha_apertura: fila.fecha_apertura,
      fecha_cierre: fila.fecha_cierre,
      abrio: fila.abrio?.nombre_usuario ?? '—',
      cerro: fila.cerro?.nombre_usuario ?? '—',
      monto_inicial: Number(fila.monto_inicial),
      monto_esperado: Number(fila.monto_esperado),
      monto_contado: Number(fila.monto_contado),
      diferencia: Number(fila.diferencia),
      cantidad_ventas: fila.ventas.length,
      ventas_por_medio,
    }
  })
}
