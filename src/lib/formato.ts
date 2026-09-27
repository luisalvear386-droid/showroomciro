const formatoMoneda = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** "$ 184.500" — mismo formato que los prototipos. */
export function formatearMoneda(monto: number): string {
  return `$ ${formatoMoneda.format(monto)}`
}

/** "Sábado 26 de septiembre" */
export function formatearFechaLarga(fecha: Date): string {
  const texto = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "09:40" */
export function formatearHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Parsea un monto escrito a mano en formato argentino: "20.000", "20000", "1.250,50", "$ 500".
 * Devuelve null si no es un número válido.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  const monto = Number(limpio)
  return Number.isFinite(monto) ? monto : null
}

/**
 * Días desde hoy (fecha local del navegador) hasta una fecha 'YYYY-MM-DD'.
 * Negativo = ya pasó. Se compara en UTC para que el horario de verano no corra un día.
 */
export function diasHasta(fechaIso: string, hoy: Date = new Date()): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  const objetivo = Date.UTC(anio, mes - 1, dia)
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((objetivo - base) / 86_400_000)
}
