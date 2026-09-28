import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useConsulta } from '../hooks/use-consulta'
import { obtenerHistorialCajas, type JornadaCaja } from '../lib/caja'
import {
  fechaIsoLocal,
  formatearFechaCorta,
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
} from '../lib/formato'
import './caja-historial-page.css'

const RANGOS = [7, 15, 30]

function haceDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fechaIsoLocal(fecha)
}

function tonoDiferencia(diferencia: number): 'ok' | 'sobra' | 'falta' {
  if (diferencia === 0) return 'ok'
  return diferencia > 0 ? 'sobra' : 'falta'
}

/** "+ $ 800", "− $ 1.500", "$ 0" */
function textoDiferencia(diferencia: number): string {
  const signo = diferencia > 0 ? '+ ' : diferencia < 0 ? '− ' : ''
  return signo + formatearMoneda(Math.abs(diferencia))
}

function DetalleJornada({ jornada, onCerrar }: { jornada: JornadaCaja; onCerrar: () => void }) {
  const tono = tonoDiferencia(jornada.diferencia)
  const { efectivo, transferencia, tarjeta } = jornada.ventas_por_medio
  const metricas = [
    { etiqueta: 'Monto inicial', valor: formatearMoneda(jornada.monto_inicial) },
    { etiqueta: 'Esperado', valor: formatearMoneda(jornada.monto_esperado) },
    { etiqueta: 'Contado', valor: formatearMoneda(jornada.monto_contado) },
  ]
  const medios = [
    { etiqueta: 'Efectivo', monto: efectivo, clase: 'efectivo' },
    { etiqueta: 'Transferencia / QR', monto: transferencia, clase: 'transferencia' },
    { etiqueta: 'Tarjeta', monto: tarjeta, clase: 'tarjeta' },
  ]

  return (
    <section className="jornada" aria-labelledby="jornada-titulo">
      <div className="jornada__encabezado">
        <div className="jornada__titulos">
          <h2 id="jornada-titulo" className="jornada__titulo">
            Jornada del {formatearFechaLarga(new Date(jornada.fecha_apertura))}
          </h2>
          <span className="jornada__linea">
            Abrió {jornada.abrio} · cerró {jornada.cerro} · {jornada.cantidad_ventas}{' '}
            {jornada.cantidad_ventas === 1 ? 'venta' : 'ventas'}
          </span>
        </div>
        <button type="button" className="jornada__cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
          ×
        </button>
      </div>

      <div className="jornada__metricas">
        {metricas.map((m) => (
          <div key={m.etiqueta} className="jornada__metrica">
            <span className="jornada__metrica-etiqueta">{m.etiqueta}</span>
            <span className="jornada__metrica-valor">{m.valor}</span>
          </div>
        ))}
        <div className={`jornada__metrica jornada__metrica--${tono}`}>
          <span className="jornada__metrica-etiqueta">Diferencia</span>
          <span className="jornada__metrica-valor">{textoDiferencia(jornada.diferencia)}</span>
        </div>
      </div>

      {/* Sin "Ventas fiadas" ni nota: las cuentas no pasan por caja y `cajas` no guarda notas */}
      <div className="jornada__listas">
        <div className="jornada__lista">
          <span className="jornada__lista-titulo">Ventas por medio de pago</span>
          {medios.map((m) => (
            <div key={m.clase} className="jornada__fila">
              <span className="jornada__medio">
                <span className={`jornada__punto jornada__punto--${m.clase}`} aria-hidden="true" />
                {m.etiqueta}
              </span>
              <span className="jornada__fila-valor">{formatearMoneda(m.monto)}</span>
            </div>
          ))}
        </div>
        <div className="jornada__lista">
          <span className="jornada__lista-titulo">Movimientos</span>
          <div className="jornada__fila">
            <span className="jornada__fila-etiqueta">Ventas del día</span>
            <span className="jornada__fila-valor">{jornada.cantidad_ventas}</span>
          </div>
          <div className="jornada__fila">
            <span className="jornada__fila-etiqueta">Total vendido</span>
            <span className="jornada__fila-valor">{formatearMoneda(efectivo + transferencia + tarjeta)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Caja — Historial (solo Dueño/a, solo lectura), según prototipos/Caja Historial.dc.html.
 * Sin el botón "Exportar" del prototipo: no está en requirements.md.
 */
export function CajaHistorialPage() {
  const [desde, setDesde] = useState(() => haceDias(7))
  const [hasta, setHasta] = useState(() => haceDias(0))
  const [rango, setRango] = useState<number | null>(7)
  // Por defecto se muestra el detalle de la jornada más reciente, como en el prototipo
  const [seleccion, setSeleccion] = useState<number>(0)

  const consultar = useCallback(() => obtenerHistorialCajas(desde, hasta), [desde, hasta])
  const { datos, error, cargando, recargar } = useConsulta(consultar)

  const jornadas = datos ?? []
  const conDiferencia = jornadas.filter((j) => j.diferencia !== 0).length
  const seleccionada = jornadas[seleccion]

  function elegirRango(dias: number) {
    setDesde(haceDias(dias))
    setHasta(haceDias(0))
    setRango(dias)
    setSeleccion(0)
  }

  let estado: string | null = null
  if (error) estado = 'No se pudo cargar el historial. Revisá la conexión.'
  else if (datos === undefined) estado = 'Cargando…'
  else if (jornadas.length === 0 && !cargando) estado = 'No hay jornadas en el rango elegido.'

  return (
    <div className="historial">
      <div className="historial__encabezado">
        <div className="historial__titulos">
          <h1 className="historial__titulo">Historial de Caja</h1>
          <p className="historial__bajada">
            {datos === undefined
              ? ' '
              : `${jornadas.length} ${jornadas.length === 1 ? 'jornada' : 'jornadas'} en el rango · ${conDiferencia} con diferencia`}
          </p>
        </div>
        <Link to="/caja" className="historial__volver">
          Volver al cierre
        </Link>
      </div>

      <div className="historial__filtros">
        <div className="historial__fechas">
          <label htmlFor="desde" className="historial__fecha-label">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            className="historial__fecha"
            value={desde}
            max={hasta}
            onChange={(e) => {
              setDesde(e.target.value)
              setRango(null)
              setSeleccion(0)
            }}
          />
          <span className="historial__fechas-separador" aria-hidden="true" />
          <label htmlFor="hasta" className="historial__fecha-label">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            className="historial__fecha"
            value={hasta}
            min={desde}
            onChange={(e) => {
              setHasta(e.target.value)
              setRango(null)
              setSeleccion(0)
            }}
          />
        </div>
        <div className="historial__rangos">
          {RANGOS.map((dias) => (
            <button
              key={dias}
              type="button"
              className="historial__rango"
              aria-pressed={rango === dias}
              onClick={() => elegirRango(dias)}
            >
              {dias} días
            </button>
          ))}
        </div>
      </div>

      <div className="historial__card">
        <div className="historial__scroll">
          <table className="historial__tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Abrió</th>
                <th>Cerró</th>
                <th className="historial__num">Inicial</th>
                <th className="historial__num">Esperado</th>
                <th className="historial__num">Contado</th>
                <th className="historial__num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {jornadas.map((j, i) => {
                const apertura = new Date(j.fecha_apertura)
                return (
                  <tr
                    key={j.id}
                    className={i === seleccion ? 'historial__fila historial__fila--activa' : 'historial__fila'}
                    onClick={() => setSeleccion(i)}
                  >
                    <td>
                      <button type="button" className="historial__fecha-celda" onClick={() => setSeleccion(i)}>
                        <span className="historial__dia">{formatearFechaCorta(apertura)}</span>
                        <span className="historial__horario">
                          {formatearHora(apertura)} – {formatearHora(new Date(j.fecha_cierre))}
                        </span>
                      </button>
                    </td>
                    <td className="historial__usuario">{j.abrio}</td>
                    <td className="historial__usuario">{j.cerro}</td>
                    <td className="historial__num">{formatearMoneda(j.monto_inicial)}</td>
                    <td className="historial__num">{formatearMoneda(j.monto_esperado)}</td>
                    <td className="historial__num historial__contado">{formatearMoneda(j.monto_contado)}</td>
                    <td className="historial__num">
                      <span className={`historial__diferencia historial__diferencia--${tonoDiferencia(j.diferencia)}`}>
                        {textoDiferencia(j.diferencia)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {estado && (
          <div className="historial__estado">
            <span>{estado}</span>
            {error && (
              <button type="button" className="boton-secundario" onClick={recargar}>
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      {seleccionada && <DetalleJornada jornada={seleccionada} onCerrar={() => setSeleccion(-1)} />}
    </div>
  )
}
