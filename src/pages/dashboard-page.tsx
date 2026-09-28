import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { useCaja } from '../caja/use-caja'
import { useConsulta } from '../hooks/use-consulta'
import { useEsMobile } from '../hooks/use-es-mobile'
import { obtenerCuentasEnAlerta, obtenerStockBajo } from '../lib/alertas'
import { refrescarCatalogo } from '../lib/catalogo-local'
import { describirVencimiento } from '../lib/cuentas'
import { formatearFechaLarga, formatearHora, formatearMoneda } from '../lib/formato'
import './dashboard-page.css'

function MensajePanel({ cargando, error, vacio }: { cargando: boolean; error: boolean; vacio: string }) {
  let texto = vacio
  if (error) texto = 'No se pudo cargar. Revisá la conexión.'
  else if (cargando) texto = 'Cargando…'
  return <p className="alertas__vacio">{texto}</p>
}

/** Dashboard/Inicio — según prototipos/Dashboard ShowroomCiro.dc.html y Mobile Dashboard.dc.html */
export function DashboardPage() {
  const { perfil, sesionOffline } = useAuth()
  const { caja, refrescar } = useCaja()
  const esMobile = useEsMobile()
  const navigate = useNavigate()
  const stock = useConsulta(obtenerStockBajo)
  const cuentas = useConsulta(obtenerCuentasEnAlerta)

  // Al volver al Dashboard (ej. después de una venta) se actualizan los KPIs del turno
  useEffect(() => {
    refrescar().catch(() => undefined)
  }, [refrescar])

  // Deja el catálogo del POS guardado en la base local por si después se corta internet
  // (Módulo 11). Solo en el mostrador: desde el celular no se vende.
  useEffect(() => {
    if (!esMobile && !sesionOffline) refrescarCatalogo().catch(() => undefined)
  }, [esMobile, sesionOffline])

  const stockBajo = stock.datos ?? []
  const cuentasEnAlerta = cuentas.datos ?? []
  const totalAlertas = stockBajo.length + cuentasEnAlerta.length
  const alertasCargadas = stock.datos !== undefined && cuentas.datos !== undefined

  return (
    <div className="dashboard">
      <div className="dashboard__encabezado">
        <div className="dashboard__titulos">
          <h1 className="dashboard__saludo">Buen día, {perfil?.nombre_usuario}</h1>
          <p className="dashboard__bajada">
            {esMobile ? formatearFechaLarga(new Date()) : 'Esto es lo que pasa hoy en el local.'}
          </p>
        </div>
        {/* Mobile es acceso remoto de solo consulta: sin acciones de venta ni alta de cuentas */}
        {!esMobile && (
          <div className="dashboard__acciones">
            <button type="button" className="dashboard__accion" onClick={() => navigate('/ventas')}>
              Nueva Venta
            </button>
            <button
              type="button"
              className="dashboard__accion dashboard__accion--secundaria"
              onClick={() => navigate('/cuentas/nueva')}
            >
              Nueva Cuenta
            </button>
          </div>
        )}
      </div>

      <div className="dashboard__kpis">
        <div className="kpi">
          <span className="kpi__titulo">Ventas de hoy</span>
          <span className="kpi__valor">{formatearMoneda(caja?.total_vendido ?? 0)}</span>
          <span className={caja ? 'kpi__detalle kpi__detalle--ok' : 'kpi__detalle'}>
            <span className="kpi__punto" aria-hidden="true" />
            {caja
              ? `${caja.cantidad_ventas} ${caja.cantidad_ventas === 1 ? 'venta' : 'ventas'}`
              : 'Sin caja abierta'}
          </span>
        </div>

        {/* Sin monto esperado: el cierre es a conteo ciego (caja_actual_resumen no lo expone) */}
        <div className="kpi">
          <span className="kpi__titulo">Caja actual</span>
          <span className="kpi__valor">{caja ? 'Abierta' : 'Cerrada'}</span>
          <span className="kpi__detalle">
            {caja
              ? `Desde las ${formatearHora(new Date(caja.fecha_apertura))}`
              : 'Se abre desde el mostrador'}
          </span>
        </div>
      </div>

      <section className="alertas">
        <div className="alertas__encabezado">
          <h2 className="alertas__titulo">Alertas</h2>
          {alertasCargadas && (
            <span className="alertas__contador">
              {totalAlertas === 0 ? 'Todo en orden' : `${totalAlertas} para revisar`}
            </span>
          )}
        </div>

        <div className="alertas__grupos">
          <div className="alertas__grupo">
            <div className="alertas__grupo-titulo alertas__grupo-titulo--coral">
              <span className="alertas__grupo-punto" aria-hidden="true" />
              Stock bajo
            </div>
            {stockBajo.length > 0 ? (
              stockBajo.map((v) => (
                <div key={v.id} className="alerta alerta--coral">
                  <span className="alerta__textos">
                    <span className="alerta__principal">{v.producto_nombre}</span>
                    <span className="alerta__secundario">
                      Talle {v.talle} · {v.color}
                    </span>
                  </span>
                  <span className="alerta__dato">{v.stock} u.</span>
                </div>
              ))
            ) : (
              <MensajePanel
                cargando={stock.datos === undefined}
                error={stock.error}
                vacio="Sin variantes con stock bajo."
              />
            )}
          </div>

          <div className="alertas__grupo">
            <div className="alertas__grupo-titulo alertas__grupo-titulo--vino">
              <span className="alertas__grupo-punto" aria-hidden="true" />
              Cuentas
            </div>
            {cuentasEnAlerta.length > 0 ? (
              cuentasEnAlerta.map((c) => {
                const variante = c.estado === 'vencido' ? 'vino' : 'coral'
                return (
                  <div key={c.id} className={`alerta alerta--${variante}`}>
                    <span className="alerta__textos">
                      <span className="alerta__principal">{c.cliente_nombre}</span>
                      <span className="alerta__secundario alerta__secundario--estado">{describirVencimiento(c.fecha_limite)}</span>
                    </span>
                    <span className="alerta__dato">{formatearMoneda(c.saldo)}</span>
                  </div>
                )
              })
            ) : (
              <MensajePanel
                cargando={cuentas.datos === undefined}
                error={cuentas.error}
                vacio="Sin cuentas vencidas ni por vencer."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
