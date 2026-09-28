import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useConsulta } from '../hooks/use-consulta'
import { formatearMoneda } from '../lib/formato'
import {
  obtenerCuentasPendientes,
  obtenerReportePeriodo,
  type BarraVentas,
  type Periodo,
  type ProductoTop,
} from '../lib/reportes'
import './reportes-page.css'

const PERIODOS: { valor: Periodo; etiqueta: string; rango: string; hint: string }[] = [
  { valor: 'dia', etiqueta: 'Día', rango: 'Hoy', hint: 'Por franja horaria, hoy' },
  { valor: 'semana', etiqueta: 'Semana', rango: 'Últimos 7 días', hint: 'Últimos 7 días' },
  { valor: 'mes', etiqueta: 'Mes', rango: 'Últimos 30 días', hint: 'Por semana, últimos 30 días' },
]

/** Alto máximo de una barra en px (prototipo). */
const ALTO_BARRA = 158

/** "$184k", "$1.2M" — etiqueta corta sobre cada barra, como en el prototipo. */
function montoCorto(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(1)}M`
  if (monto >= 1000) return `$${Math.round(monto / 1000)}k`
  return `$${Math.round(monto)}`
}

function GraficoVentas({ barras }: { barras: BarraVentas[] }) {
  const maximo = Math.max(...barras.map((b) => b.total), 0)
  return (
    <div className={barras.length > 6 ? 'grafico grafico--denso' : 'grafico'}>
      {barras.map((b) => (
        <div key={b.etiqueta} className="grafico__columna" title={`${b.detalle}: ${formatearMoneda(b.total)}`}>
          <div className="grafico__pila">
            <span className="grafico__monto">{montoCorto(b.total)}</span>
            <span
              className="grafico__barra"
              style={{ height: maximo > 0 ? Math.round((b.total / maximo) * ALTO_BARRA) : 0 }}
            />
          </div>
          <span className="grafico__etiqueta">{b.etiqueta}</span>
        </div>
      ))}
    </div>
  )
}

function RankingProductos({ productos }: { productos: ProductoTop[] }) {
  if (productos.length === 0) {
    return <p className="reportes__vacio">No hubo ventas en el período.</p>
  }
  const maximo = Math.max(...productos.map((p) => p.unidades_vendidas))
  return (
    <ol className="ranking">
      {productos.map((p) => {
        // Los 3 primeros puestos con color propio, como en el prototipo
        const tono = p.ranking <= 3 ? `ranking--${p.ranking}` : ''
        return (
          <li key={p.producto_id} className={`ranking__fila ${tono}`}>
            <span className="ranking__pos">{p.ranking}</span>
            <span className="ranking__cuerpo">
              <span className="ranking__linea">
                <span className="ranking__nombre">{p.producto_nombre}</span>
                <span className="ranking__cifras">
                  <strong>{p.unidades_vendidas} u.</strong> · {formatearMoneda(p.total_vendido)}
                </span>
              </span>
              <span className="ranking__pista">
                <span
                  className="ranking__barra"
                  style={{ width: `${Math.round((p.unidades_vendidas / maximo) * 100)}%` }}
                />
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function CuentasPendientesCard() {
  const { datos, error, recargar } = useConsulta(obtenerCuentasPendientes)

  return (
    <section className="reportes__card reportes__cuentas" aria-labelledby="cuentas-titulo">
      <h2 id="cuentas-titulo" className="reportes__card-titulo">
        Cuentas pendientes
      </h2>

      {error ? (
        <div className="reportes__estado">
          <span>No se pudieron cargar las cuentas.</span>
          <button type="button" className="boton-secundario" onClick={recargar}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="reportes__adeudado">
            <span className="reportes__kpi-etiqueta">Total adeudado</span>
            <span className="reportes__adeudado-valor">{datos ? formatearMoneda(datos.total_adeudado) : '—'}</span>
            <span className="reportes__adeudado-detalle">
              {datos
                ? `${datos.cantidad_pendientes} ${datos.cantidad_pendientes === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`
                : 'Cargando…'}
            </span>
          </div>

          <div className="reportes__alertas">
            <div className="reportes__alerta reportes__alerta--por-vencer">
              <span className="reportes__alerta-etiqueta">
                <span className="reportes__alerta-punto" aria-hidden="true" />
                Próximas a vencer
              </span>
              <span className="reportes__alerta-valor">{datos?.cantidad_por_vencer ?? '—'}</span>
            </div>
            <div className="reportes__alerta reportes__alerta--vencida">
              <span className="reportes__alerta-etiqueta">
                <span className="reportes__alerta-punto" aria-hidden="true" />
                Vencidas
              </span>
              <span className="reportes__alerta-valor">{datos?.cantidad_vencidas ?? '—'}</span>
            </div>
          </div>
        </>
      )}

      <Link to="/cuentas" className="reportes__enlace">
        Ir a la agenda de cuentas →
      </Link>
    </section>
  )
}

/**
 * Reportes (solo Dueño/a), según prototipos/Reportes.dc.html. Consulta las vistas/RPCs de
 * reportes del Módulo 2, que además rechazan o vacían la respuesta si no es Dueño/a.
 *
 * Diferencias con el prototipo: no hay "Fiado" en las ventas (las cuentas no pasan por el
 * checkout), así que el gráfico tiene una sola serie y no está el KPI "Vendido en fiado";
 * el panel es "Cuentas pendientes" sin "Cobrados en el período" ni cantidad de clientes
 * (requirements.md pide total adeudado y próximas a vencer).
 */
export function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const consultar = useCallback(() => obtenerReportePeriodo(periodo), [periodo])
  const { datos, error, cargando, recargar } = useConsulta(consultar)
  const actual = PERIODOS.find((p) => p.valor === periodo) ?? PERIODOS[1]

  // Mientras llega el período nuevo (o si falló) no se muestran los números del anterior
  const reporte = cargando || error ? undefined : datos
  const sinDatos = error ? '—' : 'Cargando…'
  const kpis = [
    {
      etiqueta: 'Vendido',
      valor: reporte ? formatearMoneda(reporte.total_vendido) : '—',
      detalle: reporte ? `${reporte.cantidad_ventas} ${reporte.cantidad_ventas === 1 ? 'venta' : 'ventas'}` : ' ',
    },
    {
      etiqueta: 'Ticket promedio',
      valor: reporte ? formatearMoneda(reporte.ticket_promedio) : '—',
      detalle: 'por venta',
    },
  ]

  return (
    <div className="reportes">
      <div className="reportes__encabezado">
        <div className="reportes__titulos">
          <h1 className="reportes__titulo">Reportes</h1>
          <p className="reportes__bajada">Solo visible para el rol Dueño/a.</p>
        </div>
        <div className="reportes__periodos" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              className="reportes__periodo"
              aria-pressed={p.valor === periodo}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="reportes__card reportes__estado">
          <span>No se pudo cargar el reporte. Revisá la conexión.</span>
          <button type="button" className="boton-secundario" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      <div className="reportes__kpis">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="reportes__card reportes__kpi">
            <span className="reportes__kpi-etiqueta">{k.etiqueta}</span>
            <span className="reportes__kpi-valor">{k.valor}</span>
            <span className="reportes__kpi-detalle">{k.detalle}</span>
          </div>
        ))}
      </div>

      <section className="reportes__card reportes__ventas" aria-labelledby="ventas-titulo">
        <div className="reportes__card-encabezado">
          <h2 id="ventas-titulo" className="reportes__card-titulo">
            Ventas del período
          </h2>
          <span className="reportes__card-hint">{actual.hint}</span>
        </div>
        {reporte ? <GraficoVentas barras={reporte.barras} /> : <div className="grafico grafico--vacio">{sinDatos}</div>}
      </section>

      <div className="reportes__inferior">
        <section className="reportes__card" aria-labelledby="top-titulo">
          <div className="reportes__card-fila">
            <h2 id="top-titulo" className="reportes__card-titulo">
              Productos más vendidos
            </h2>
            <span className="reportes__card-rango">{actual.rango}</span>
          </div>
          {reporte ? <RankingProductos productos={reporte.top} /> : <p className="reportes__vacio">{sinDatos}</p>}
        </section>

        <CuentasPendientesCard />
      </div>
    </div>
  )
}
