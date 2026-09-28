import { fechaIsoLocal, formatearFechaCorta } from './formato'
import { supabase } from './supabase'

/**
 * Períodos de la pantalla de Reportes. Como en el prototipo, son móviles y terminan hoy:
 * "Hoy", "Últimos 7 días" y "Últimos 30 días".
 */
export type Periodo = 'dia' | 'semana' | 'mes'

const DIAS_PERIODO: Record<Periodo, number> = { dia: 1, semana: 7, mes: 30 }

export interface ProductoTop {
  producto_id: string
  producto_nombre: string
  unidades_vendidas: number
  total_vendido: number
  /** 1 = más vendido. Empates comparten posición (rank()). */
  ranking: number
}

export interface BarraVentas {
  etiqueta: string
  /** Rango que cubre la barra, para el tooltip. */
  detalle: string
  total: number
}

export interface ReportePeriodo {
  cantidad_ventas: number
  total_vendido: number
  ticket_promedio: number
  top: ProductoTop[]
  barras: BarraVentas[]
}

/** Fila única de `reportes_cuentas_pendientes_vista`. */
export interface CuentasPendientes {
  total_adeudado: number
  cantidad_pendientes: number
  cantidad_por_vencer: number
  cantidad_vencidas: number
}

const TOP_PRODUCTOS = 5

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() + dias)
  return copia
}

/** "Lun", "Mar", "Mié"… */
function diaSemana(fecha: Date): string {
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Hoy: ventas por franja de 2 horas, leídas de `ventas` (el Dueño/a las ve todas por RLS). */
async function barrasDelDia(hoy: Date): Promise<BarraVentas[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('fecha, total')
    // Medianoche local, no de UTC
    .gte('fecha', hoy.toISOString())
    .lt('fecha', sumarDias(hoy, 1).toISOString())
  if (error) throw error

  const ventas = (data ?? []).map((v) => ({ hora: new Date(v.fecha as string).getHours(), total: Number(v.total) }))

  // Franjas del horario comercial del prototipo (10h a 20h), ampliadas si hubo ventas fuera
  const horas = ventas.map((v) => v.hora)
  const desde = Math.floor(Math.min(10, ...horas) / 2) * 2
  const hasta = Math.floor(Math.max(20, ...horas) / 2) * 2

  const barras: BarraVentas[] = []
  for (let h = desde; h <= hasta; h += 2) {
    barras.push({
      etiqueta: `${h}h`,
      detalle: `${h}:00 a ${h + 2}:00`,
      total: ventas.filter((v) => v.hora >= h && v.hora < h + 2).reduce((s, v) => s + v.total, 0),
    })
  }
  return barras
}

/** Total por día del rango, desde `reportes_ventas_vista` (periodo 'dia'). Días sin ventas = 0. */
async function totalesPorDia(desde: string, hasta: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('reportes_ventas_vista')
    .select('fecha_inicio, total_vendido')
    .eq('periodo', 'dia')
    .gte('fecha_inicio', desde)
    .lte('fecha_inicio', hasta)
  if (error) throw error

  return new Map((data ?? []).map((f) => [f.fecha_inicio as string, Number(f.total_vendido)]))
}

function barrasDeDias(dias: Date[], totales: Map<string, number>, etiqueta: (dia: Date, i: number) => string) {
  return dias.map((dia, i) => ({
    etiqueta: etiqueta(dia, i),
    detalle: formatearFechaCorta(dia),
    total: totales.get(fechaIsoLocal(dia)) ?? 0,
  }))
}

/**
 * Últimos 30 días en 4 barras "Sem 1…4" como en el prototipo: 30 días no son 4 semanas
 * justas, así que las dos primeras barras cubren 8 días y las otras dos 7.
 */
function barrasDelMes(dias: Date[], totales: Map<string, number>): BarraVentas[] {
  const tamanios = [8, 8, 7, 7]
  let inicio = 0
  return tamanios.map((tamanio, i) => {
    const tramo = dias.slice(inicio, inicio + tamanio)
    inicio += tamanio
    return {
      etiqueta: `Sem ${i + 1}`,
      detalle: `${formatearFechaCorta(tramo[0])} a ${formatearFechaCorta(tramo[tramo.length - 1])}`,
      total: tramo.reduce((s, d) => s + (totales.get(fechaIsoLocal(d)) ?? 0), 0),
    }
  })
}

/**
 * Ventas, ticket promedio y top productos del período, vía las RPCs de rango del Módulo 2
 * (`reporte_ventas_rango`, `reporte_top_productos_rango`), que rechazan a quien no sea Dueño/a.
 */
export async function obtenerReportePeriodo(periodo: Periodo): Promise<ReportePeriodo> {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const cantidadDias = DIAS_PERIODO[periodo]
  const dias = Array.from({ length: cantidadDias }, (_, i) => sumarDias(hoy, i - cantidadDias + 1))
  const desde = fechaIsoLocal(dias[0])
  const hasta = fechaIsoLocal(hoy)

  const [resumen, top, barras] = await Promise.all([
    supabase.rpc('reporte_ventas_rango', { desde, hasta }),
    supabase.rpc('reporte_top_productos_rango', { desde, hasta, limite: TOP_PRODUCTOS }),
    periodo === 'dia'
      ? barrasDelDia(hoy)
      : totalesPorDia(desde, hasta).then((totales) =>
          periodo === 'semana' ? barrasDeDias(dias, totales, diaSemana) : barrasDelMes(dias, totales),
        ),
  ])
  if (resumen.error) throw resumen.error
  if (top.error) throw top.error

  // numeric llega como number o string según el tamaño: se normaliza
  const fila = ((resumen.data ?? []) as Record<string, number | string>[])[0]
  return {
    cantidad_ventas: Number(fila?.cantidad_ventas ?? 0),
    total_vendido: Number(fila?.total_vendido ?? 0),
    ticket_promedio: Number(fila?.ticket_promedio ?? 0),
    top: ((top.data ?? []) as ProductoTop[]).map((p) => ({
      producto_id: p.producto_id,
      producto_nombre: p.producto_nombre,
      unidades_vendidas: Number(p.unidades_vendidas),
      total_vendido: Number(p.total_vendido),
      ranking: Number(p.ranking),
    })),
    barras,
  }
}

/** Resumen de cuentas con saldo pendiente. No depende del período: es el estado actual. */
export async function obtenerCuentasPendientes(): Promise<CuentasPendientes> {
  const { data, error } = await supabase.from('reportes_cuentas_pendientes_vista').select('*').single()
  if (error) throw error

  return {
    total_adeudado: Number(data.total_adeudado),
    cantidad_pendientes: Number(data.cantidad_pendientes),
    cantidad_por_vencer: Number(data.cantidad_por_vencer),
    cantidad_vencidas: Number(data.cantidad_vencidas),
  }
}