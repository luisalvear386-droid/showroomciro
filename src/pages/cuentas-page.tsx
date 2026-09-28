import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CuentaDetalleModal } from '../components/cuenta-detalle-modal'
import { useConsulta } from '../hooks/use-consulta'
import { useEsMobile } from '../hooks/use-es-mobile'
import { useRefrescarAlertasCuentas } from '../hooks/use-refrescar-alertas-cuentas'
import {
  ETIQUETA_ESTADO,
  iniciales,
  obtenerCuentas,
  vencimientoRelativo,
  type Cuenta,
} from '../lib/cuentas'
import { fechaDesdeIso, fechaIsoLocal, formatearFechaCorta, formatearMoneda } from '../lib/formato'
import './cuentas-page.css'

type Vista = 'lista' | 'calendario'

const VISTAS: { vista: Vista; etiqueta: string }[] = [
  { vista: 'lista', etiqueta: 'Vista Lista' },
  { vista: 'calendario', etiqueta: 'Vista Calendario' },
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function primeroDelMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function nombreMes(fecha: Date): string {
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "Lucía · $32k" — etiqueta compacta de un vencimiento en la celda del calendario. */
function etiquetaEvento(cuenta: Cuenta): string {
  const nombre = cuenta.cliente_nombre.trim().split(/\s+/)[0]
  const miles = cuenta.saldo / 1000
  const monto = miles >= 1 ? `$${miles.toLocaleString('es-AR', { maximumFractionDigits: 1 })}k` : formatearMoneda(cuenta.saldo)
  return `${nombre} · ${monto}`
}

interface Celda {
  clave: string
  dia: number | null
  esHoy: boolean
  cuentas: Cuenta[]
}

/** Celdas del mes (semana de lunes a domingo), con los vencimientos de cada día. */
function armarMes(mes: Date, cuentas: Cuenta[]): Celda[] {
  const anio = mes.getFullYear()
  const numeroMes = mes.getMonth()
  const desfase = (mes.getDay() + 6) % 7
  const diasDelMes = new Date(anio, numeroMes + 1, 0).getDate()
  const hoy = fechaIsoLocal(new Date())

  const porDia = new Map<string, Cuenta[]>()
  for (const c of cuentas) {
    porDia.set(c.fecha_limite, [...(porDia.get(c.fecha_limite) ?? []), c])
  }

  const celdas: Celda[] = []
  for (let i = 0; i < desfase; i++) celdas.push({ clave: `vacia-${i}`, dia: null, esHoy: false, cuentas: [] })
  for (let dia = 1; dia <= diasDelMes; dia++) {
    const iso = fechaIsoLocal(new Date(anio, numeroMes, dia))
    celdas.push({ clave: iso, dia, esHoy: iso === hoy, cuentas: porDia.get(iso) ?? [] })
  }
  return celdas
}

function EstadoBadge({ cuenta }: { cuenta: Cuenta }) {
  return <span className={`cuentas__estado cuentas--${cuenta.estado}`}>{ETIQUETA_ESTADO[cuenta.estado]}</span>
}

function ClienteCelda({ cuenta }: { cuenta: Cuenta }) {
  return (
    <span className="cuentas__cliente">
      <span className={`cuentas__avatar cuentas--${cuenta.estado}`} aria-hidden="true">
        {iniciales(cuenta.cliente_nombre)}
      </span>
      <span className="cuentas__cliente-nombre">{cuenta.cliente_nombre}</span>
    </span>
  )
}

/**
 * Cuentas — Agenda, según prototipos/Fiados Agenda.dc.html. Lista por defecto con toggle a
 * calendario por vencimiento. Sin botón de alta: "Nueva Cuenta" vive solo en el Dashboard.
 * Las cuentas ya pagadas no se mezclan con las activas: van en una sección plegable aparte.
 * El detalle/cobro se abre como modal en /cuentas/:id.
 */
export function CuentasPage() {
  const { id: cuentaAbierta } = useParams()
  const navigate = useNavigate()
  const esMobile = useEsMobile()
  const refrescarAlertasCuentas = useRefrescarAlertasCuentas()
  const cuentas = useConsulta(obtenerCuentas)
  const { recargar: recargarCuentas } = cuentas

  const [vista, setVista] = useState<Vista>('lista')
  const [busqueda, setBusqueda] = useState('')
  const [ordenAscendente, setOrdenAscendente] = useState(true)
  const [verPagadas, setVerPagadas] = useState(false)
  const [mes, setMes] = useState(() => primeroDelMes(new Date()))

  const todas = useMemo(() => cuentas.datos ?? [], [cuentas.datos])
  const activas = useMemo(() => todas.filter((c) => c.estado !== 'pagado'), [todas])

  const { activasVisibles, pagadasVisibles } = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    const coincide = (c: Cuenta) => !termino || normalizar(c.cliente_nombre).includes(termino)
    const porFecha = (a: Cuenta, b: Cuenta) =>
      (ordenAscendente ? 1 : -1) * a.fecha_limite.localeCompare(b.fecha_limite)
    return {
      activasVisibles: activas.filter(coincide).sort(porFecha),
      // Las saldadas, de la que venció más recientemente a la más vieja
      pagadasVisibles: todas
        .filter((c) => c.estado === 'pagado' && coincide(c))
        .sort((a, b) => b.fecha_limite.localeCompare(a.fecha_limite)),
    }
  }, [todas, activas, busqueda, ordenAscendente])

  const celdas = useMemo(() => armarMes(mes, activas), [mes, activas])
  const mesActual = useMemo(() => armarMes(primeroDelMes(new Date()), activas), [activas])
  const diasConVencimientos = celdas.filter((c) => c.cuentas.length > 0).length

  const totalPorCobrar = activas.reduce((suma, c) => suma + c.saldo, 0)
  const vencidas = activas.filter((c) => c.estado === 'vencido').length
  const cantidadPagadas = todas.length - activas.length

  const abrir = useCallback((id: string) => navigate(`/cuentas/${id}`), [navigate])
  const cerrar = useCallback(() => navigate('/cuentas', { replace: true }), [navigate])
  const alCobrar = useCallback(() => {
    recargarCuentas()
    refrescarAlertasCuentas()
  }, [recargarCuentas, refrescarAlertasCuentas])

  let resumen = ''
  if (cuentas.datos) {
    resumen = `${formatearMoneda(totalPorCobrar)} por cobrar · ${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}`
  } else if (cuentas.error) {
    resumen = 'No se pudieron cargar las cuentas. Revisá la conexión.'
  }

  let mensajeVacio: string | null = null
  if (!cuentas.datos) mensajeVacio = cuentas.error ? 'No se pudieron cargar las cuentas.' : 'Cargando…'
  else if (activas.length === 0) mensajeVacio = 'No hay cuentas pendientes de cobro.'
  else if (activasVisibles.length === 0) mensajeVacio = 'No hay cuentas que coincidan con la búsqueda.'

  // En mobile (acceso remoto, solo consulta) el botón abre el detalle sin formulario de cobro
  const etiquetaAccion = esMobile ? 'Ver' : 'Cobrar'

  return (
    <div className="cuentas">
      <div className="cuentas__encabezado">
        <h1 className="cuentas__titulo">Cuentas</h1>
        <p className="cuentas__resumen">{resumen}</p>
      </div>

      <div className="cuentas__filtros">
        <div className="cuentas__vistas" role="group" aria-label="Vista">
          {VISTAS.map((v) => (
            <button
              key={v.vista}
              type="button"
              className="cuentas__vista"
              aria-pressed={vista === v.vista}
              onClick={() => setVista(v.vista)}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
        <label className="cuentas__buscador">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente…"
            aria-label="Buscar cliente"
          />
        </label>
        <div className="cuentas__leyenda">
          <span className="cuentas__leyenda-item cuentas--al_dia">Al día</span>
          <span className="cuentas__leyenda-item cuentas--por_vencer">Por vencer</span>
          <span className="cuentas__leyenda-item cuentas--vencido">Vencido</span>
        </div>
      </div>

      {vista === 'lista' ? (
        <div className="cuentas__lista">
          <div className="cuentas__tabla-card">
            <div className="cuentas__tabla-scroll">
              <table className="cuentas__tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th className="num">Adeudado</th>
                    <th aria-sort={ordenAscendente ? 'ascending' : 'descending'}>
                      <button
                        type="button"
                        className="cuentas__orden"
                        onClick={() => setOrdenAscendente((a) => !a)}
                        title="Ordenar por fecha límite"
                      >
                        Fecha límite <span aria-hidden="true">{ordenAscendente ? '↑' : '↓'}</span>
                      </button>
                    </th>
                    <th>Estado</th>
                    <th className="num">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activasVisibles.map((c) => (
                    <tr key={c.id} className="cuentas__fila" onClick={() => abrir(c.id)}>
                      <td>
                        <ClienteCelda cuenta={c} />
                      </td>
                      <td className="cuentas__telefono">{c.cliente_telefono || '—'}</td>
                      <td className="num">
                        <span className="cuentas__monto">{formatearMoneda(c.saldo)}</span>
                        {c.total_pagado > 0 && (
                          <span className="cuentas__monto-original">de {formatearMoneda(c.monto_total)}</span>
                        )}
                      </td>
                      <td>
                        <span className="cuentas__vencimiento">
                          <span>{formatearFechaCorta(fechaDesdeIso(c.fecha_limite))}</span>
                          <span className={`cuentas__relativo cuentas--${c.estado}`}>
                            {vencimientoRelativo(c.fecha_limite)}
                          </span>
                        </span>
                      </td>
                      <td>
                        <EstadoBadge cuenta={c} />
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="cuentas__cobrar"
                          onClick={(e) => {
                            e.stopPropagation()
                            abrir(c.id)
                          }}
                        >
                          {etiquetaAccion}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mensajeVacio && <div className="cuentas__vacio">{mensajeVacio}</div>}
          </div>

          <button type="button" className="cuentas__ir-calendario" onClick={() => setVista('calendario')}>
            <span className="cuentas__mini" aria-hidden="true">
              {mesActual.slice(0, 28).map((celda) => (
                <span
                  key={celda.clave}
                  className={
                    celda.cuentas.length > 0
                      ? `cuentas__mini-dia cuentas__mini-dia--evento cuentas--${celda.cuentas[0].estado}`
                      : celda.dia === null
                        ? 'cuentas__mini-dia cuentas__mini-dia--vacio'
                        : 'cuentas__mini-dia'
                  }
                />
              ))}
            </span>
            <span className="cuentas__ir-textos">
              <span className="cuentas__ir-titulo">Ver la agenda como calendario</span>
              <span className="cuentas__ir-detalle">Los vencimientos del mes, marcados día por día.</span>
            </span>
            <span className="cuentas__ir-flecha">Abrir →</span>
          </button>

          {cantidadPagadas > 0 && (
            <section className="cuentas__pagadas">
              <button
                type="button"
                className="cuentas__pagadas-toggle"
                aria-expanded={verPagadas}
                onClick={() => setVerPagadas((v) => !v)}
              >
                <span className="cuentas__pagadas-titulo">Cuentas saldadas</span>
                <span className="cuentas__pagadas-cantidad">{cantidadPagadas}</span>
                <span className="cuentas__pagadas-flecha" aria-hidden="true">
                  {verPagadas ? '▴' : '▾'}
                </span>
              </button>

              {verPagadas && (
                <div className="cuentas__tabla-card cuentas__tabla-card--pagadas">
                  <div className="cuentas__tabla-scroll">
                    <table className="cuentas__tabla">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Teléfono</th>
                          <th className="num">Monto</th>
                          <th>Fecha límite</th>
                          <th>Estado</th>
                          <th className="num">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagadasVisibles.map((c) => (
                          <tr key={c.id} className="cuentas__fila" onClick={() => abrir(c.id)}>
                            <td>
                              <ClienteCelda cuenta={c} />
                            </td>
                            <td className="cuentas__telefono">{c.cliente_telefono || '—'}</td>
                            <td className="num">
                              <span className="cuentas__monto cuentas__monto--pagado">{formatearMoneda(c.monto_total)}</span>
                            </td>
                            <td>{formatearFechaCorta(fechaDesdeIso(c.fecha_limite))}</td>
                            <td>
                              <EstadoBadge cuenta={c} />
                            </td>
                            <td className="num">
                              <button
                                type="button"
                                className="cuentas__ver"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  abrir(c.id)
                                }}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pagadasVisibles.length === 0 && (
                    <div className="cuentas__vacio">No hay cuentas saldadas que coincidan con la búsqueda.</div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="cuentas__calendario">
          <div className="cuentas__calendario-encabezado">
            <div className="cuentas__mes">
              <button
                type="button"
                className="cuentas__mes-paso"
                onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <h2 className="cuentas__mes-nombre">{nombreMes(mes)}</h2>
              <button
                type="button"
                className="cuentas__mes-paso"
                onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>
            <span className="cuentas__mes-resumen">
              {diasConVencimientos} {diasConVencimientos === 1 ? 'día' : 'días'} con vencimientos
            </span>
          </div>
          <div className="cuentas__grilla-scroll">
            <div className="cuentas__grilla">
              {DIAS_SEMANA.map((d) => (
                <span key={d} className="cuentas__dia-semana">
                  {d}
                </span>
              ))}
              {celdas.map((celda) =>
                celda.dia === null ? (
                  <div key={celda.clave} className="cuentas__celda cuentas__celda--vacia" />
                ) : (
                  <div key={celda.clave} className={celda.esHoy ? 'cuentas__celda cuentas__celda--hoy' : 'cuentas__celda'}>
                    <span className="cuentas__celda-numero">{celda.dia}</span>
                    {celda.cuentas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`cuentas__evento cuentas--${c.estado}`}
                        onClick={() => abrir(c.id)}
                        title={`${c.cliente_nombre} · ${formatearMoneda(c.saldo)}`}
                      >
                        {etiquetaEvento(c)}
                      </button>
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {cuentaAbierta && (
        <CuentaDetalleModal
          key={cuentaAbierta}
          cuentaId={cuentaAbierta}
          puedeCobrar={!esMobile}
          onCerrar={cerrar}
          onCobrado={alCobrar}
        />
      )}
    </div>
  )
}
