import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { AjusteStockModal } from '../components/ajuste-stock-modal'
import { refrescarCatalogo } from '../lib/catalogo-local'
import { descartarVenta, marcarDiferenciaVista, reintentarVenta } from '../lib/cola-ventas'
import { db, type VentaConDiferencia, type VentaPendiente } from '../lib/db-local'
import { formatearFechaCorta, formatearFechaLarga, formatearHora, formatearMoneda } from '../lib/formato'
import type { Variante } from '../lib/productos'
import { MEDIOS_PAGO, type ItemCarrito } from '../lib/ventas'
import { useSincronizacion } from '../sincronizacion/use-sincronizacion'
import '../components/confirmar-modal.css'
import './caja-historial-page.css'
import './ventas-pendientes-page.css'

type Tono = 'pendiente' | 'error' | 'otro'

interface Fila {
  venta: VentaPendiente
  vendedor: string
  propia: boolean
  tono: Tono
  estado: string
}

const SIN_VENTAS: VentaPendiente[] = []
const SIN_DIFERENCIAS: VentaConDiferencia[] = []

function etiquetaMedio(medio: string): string {
  return MEDIOS_PAGO.find((m) => m.medio === medio)?.etiqueta ?? medio
}

function resumenItems(items: ItemCarrito[]): string {
  const [primero] = items
  if (!primero) return '—'
  return items.length === 1 ? primero.producto_nombre : `${primero.producto_nombre} y ${items.length - 1} más`
}

/** Qué hacer con una venta que la base rechazó, según el error. */
function ayudaError(venta: VentaPendiente): string {
  const error = venta.ultimo_error
  if (!error) return ''
  if (error.codigo === '23514') {
    return 'No alcanzó el stock en el sistema. Si la venta ocurrió, ajustá el stock de la prenda (motivo: corrección de venta sin conexión) y reintentá.'
  }
  if (error.codigo === '22023' && /caja/i.test(error.mensaje)) {
    return 'La caja de esta venta ya se cerró, así que no se puede registrar. Anotala y avisale al dueño/a antes de descartarla.'
  }
  if (error.codigo === 'P0002') {
    return 'Una de las prendas ya no existe en el sistema, así que no se puede registrar. Anotala y avisale al dueño/a antes de descartarla.'
  }
  if (['42501', 'PGRST301', 'PGRST302'].includes(error.codigo)) {
    return 'El sistema rechazó la sesión. Cerrá sesión, volvé a entrar y reintentá.'
  }
  return 'Revisá el motivo y reintentá. Si la venta no ocurrió, descartala.'
}

function ConfirmarDescarteModal({ onVolver, onConfirmar }: { onVolver: () => void; onConfirmar: () => void }) {
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') onVolver()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onVolver])

  return (
    <div className="modal-fondo" onClick={onVolver}>
      <div
        className="confirmar-cierre"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="descartar-titulo"
        aria-describedby="descartar-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="descartar-titulo" className="confirmar-cierre__titulo">
          ¿Descartar la venta?
        </h2>
        <div id="descartar-texto" className="confirmar-cierre__textos">
          <p className="confirmar-cierre__texto">
            Se borra de esta computadora y <strong>no se registra</strong>: no suma a la caja ni descuenta stock.
          </p>
          <p className="confirmar-cierre__aviso">
            <span className="confirmar-cierre__aviso-punto" aria-hidden="true" />
            Usalo solo si la venta no ocurrió. No se puede deshacer.
          </p>
        </div>
        <div className="confirmar-cierre__botones">
          <button type="button" className="boton-cancelar" onClick={onVolver} autoFocus>
            Cancelar
          </button>
          <button type="button" className="boton-primario confirmar-cierre__confirmar" onClick={onConfirmar}>
            Descartar venta
          </button>
        </div>
      </div>
    </div>
  )
}

interface DetalleProps {
  fila: Fila
  conexion: 'en-linea' | 'sin-conexion'
  sincronizando: boolean
  onCerrar: () => void
  onSincronizar: () => void
  onReintentar: () => void
  onDescartar: () => void
  onAjustar: (item: ItemCarrito) => void
  puedeAjustar: (item: ItemCarrito) => boolean
}

function DetalleVenta({
  fila,
  conexion,
  sincronizando,
  onCerrar,
  onSincronizar,
  onReintentar,
  onDescartar,
  onAjustar,
  puedeAjustar,
}: DetalleProps) {
  const { venta, vendedor, propia } = fila
  const fecha = new Date(venta.creada_en)
  const conError = venta.estado === 'con_error'
  const errorDeStock = conError && venta.ultimo_error?.codigo === '23514'

  return (
    <section className="jornada" aria-labelledby="venta-titulo">
      <div className="jornada__encabezado">
        <div className="jornada__titulos">
          <h2 id="venta-titulo" className="jornada__titulo">
            Venta del {formatearFechaLarga(fecha)} · {formatearHora(fecha)}
          </h2>
          <span className="jornada__linea">
            Vendió {vendedor} · {etiquetaMedio(venta.medio_pago)} · #{venta.id.slice(0, 8).toUpperCase()}
            {venta.intentos > 0 && ` · ${venta.intentos} ${venta.intentos === 1 ? 'intento' : 'intentos'}`}
          </span>
        </div>
        <button type="button" className="jornada__cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
          ×
        </button>
      </div>

      {conError && venta.ultimo_error && (
        <div className="pendientes__motivo">
          <div className="mensaje-error" role="alert">
            {venta.ultimo_error.mensaje}
          </div>
          <p className="pendientes__ayuda">{ayudaError(venta)}</p>
        </div>
      )}
      {!propia && (
        <p className="pendientes__ayuda">
          Es de {vendedor}: se registra a su nombre, así que se sincroniza cuando {vendedor} inicie sesión en esta
          computadora.
        </p>
      )}
      {propia && !conError && (
        <p className="pendientes__ayuda">
          {conexion === 'sin-conexion'
            ? 'Se registra sola cuando vuelva la conexión.'
            : 'Se registra sola en unos segundos. Si no, probá sincronizar ahora.'}
        </p>
      )}

      <div className="jornada__lista">
        <span className="jornada__lista-titulo">Prendas</span>
        {venta.items.map((item) => (
          <div key={item.variante_id} className="jornada__fila pendientes__item">
            <span className="pendientes__item-textos">
              <span className="jornada__fila-etiqueta">
                {item.cantidad} × {item.producto_nombre}
              </span>
              <span className="pendientes__item-variante">
                Talle {item.talle} · {item.color} · {item.sku}
              </span>
            </span>
            <span className="pendientes__item-derecha">
              {errorDeStock && propia && puedeAjustar(item) && (
                <button type="button" className="boton-secundario pendientes__ajustar" onClick={() => onAjustar(item)}>
                  Ajustar stock
                </button>
              )}
              <span className="jornada__fila-valor">{formatearMoneda(item.precio * item.cantidad)}</span>
            </span>
          </div>
        ))}
        <div className="jornada__fila">
          <span className="jornada__fila-etiqueta">Total cobrado</span>
          <span className="jornada__fila-valor">{formatearMoneda(venta.total_cobrado)}</span>
        </div>
      </div>

      {propia && (
        <div className="pendientes__acciones">
          {conError ? (
            <>
              <button type="button" className="boton-cancelar" onClick={onDescartar} disabled={sincronizando}>
                Descartar venta
              </button>
              <button type="button" className="boton-primario" onClick={onReintentar} disabled={sincronizando}>
                {sincronizando ? 'Reintentando…' : 'Reintentar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="boton-primario"
              onClick={onSincronizar}
              disabled={sincronizando || conexion === 'sin-conexion'}
            >
              {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Ventas sin sincronizar (Módulo 11): la cola de la base local, con el patrón de lista y
 * detalle del Historial de Caja. Se entra desde el indicador del header o desde el aviso del
 * Cierre de Caja; no tiene ítem de menú. Acá se resuelven a mano las ventas que la base
 * rechazó (ajustar stock y reintentar, o descartar) y se revisan las registradas con otro total.
 */
export function VentasPendientesPage() {
  const { usuario } = useAuth()
  const { pendientes, conError, deOtros, conexion, sincronizando, sincronizar } = useSincronizacion()
  const usuarioId = usuario?.id ?? null

  const cola = useLiveQuery(
    () => db.ventasPendientes.orderBy('creada_en').toArray().catch(() => SIN_VENTAS),
    [],
    SIN_VENTAS,
  )
  const diferencias = useLiveQuery(
    () =>
      usuarioId
        ? db.ventasConDiferencia.where('usuario_id').equals(usuarioId).sortBy('creada_en').catch(() => SIN_DIFERENCIAS)
        : SIN_DIFERENCIAS,
    [usuarioId],
    SIN_DIFERENCIAS,
  )
  // Nombres de quienes vendieron (perfiles de los usuarios que entraron en esta computadora)
  const nombres = useLiveQuery(
    () =>
      db.perfiles
        .toArray()
        .then((perfiles) => new Map(perfiles.map((p) => [p.id, p.nombre_usuario])))
        .catch(() => new Map<string, string>()),
    [],
  )
  // Variantes del catálogo guardado, para ajustar stock desde acá
  const variantes = useLiveQuery(
    () =>
      db.productos
        .toArray()
        .then((productos) => {
          const mapa = new Map<string, { variante: Variante; fotoUrl: string | null }>()
          for (const p of productos) for (const v of p.variantes) mapa.set(v.id, { variante: v, fotoUrl: p.foto_url })
          return mapa
        })
        .catch(() => new Map<string, { variante: Variante; fotoUrl: string | null }>()),
    [],
  )

  const filas = useMemo<Fila[]>(
    () =>
      cola.map((venta) => {
        const propia = venta.usuario_id === usuarioId
        const vendedor = nombres?.get(venta.usuario_id) ?? 'otro usuario'
        if (!propia) return { venta, vendedor, propia, tono: 'otro', estado: `De ${vendedor}` }
        if (venta.estado === 'con_error') return { venta, vendedor, propia, tono: 'error', estado: 'Con error' }
        return { venta, vendedor, propia, tono: 'pendiente', estado: 'Pendiente' }
      }),
    [cola, nombres, usuarioId],
  )

  // Por defecto, la primera con error (lo que hay que resolver); si no, la primera
  const [elegida, setElegida] = useState<string | null>(null)
  const seleccionada =
    elegida === '' ? undefined : (filas.find((f) => f.venta.id === elegida) ?? filas.find((f) => f.tono === 'error') ?? filas[0])

  const [aDescartar, setADescartar] = useState<string | null>(null)
  const [ajuste, setAjuste] = useState<ItemCarrito | null>(null)
  const datosAjuste = ajuste ? variantes?.get(ajuste.variante_id) : undefined

  async function reintentar(id: string) {
    await reintentarVenta(id)
    await sincronizar({ esperar: true })
  }

  const partes = [
    pendientes > 0 && `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`,
    conError > 0 && `${conError} con error`,
    deOtros > 0 && `${deOtros} de otro usuario`,
  ].filter(Boolean)

  return (
    <div className="historial">
      <div className="historial__encabezado">
        <div className="historial__titulos">
          <h1 className="historial__titulo">Ventas sin sincronizar</h1>
          <p className="historial__bajada">
            {partes.length > 0
              ? partes.join(' · ')
              : 'Todas las ventas de esta computadora están registradas en el sistema.'}
          </p>
        </div>
        <Link to="/" className="historial__volver">
          Volver al Dashboard
        </Link>
      </div>

      <div className="historial__card">
        <div className="historial__scroll">
          <table className="historial__tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Prendas</th>
                <th>Medio de pago</th>
                <th className="historial__num">Cobrado</th>
                <th className="historial__num">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const fecha = new Date(f.venta.creada_en)
                const activa = f.venta.id === seleccionada?.venta.id
                return (
                  <tr
                    key={f.venta.id}
                    className={activa ? 'historial__fila historial__fila--activa' : 'historial__fila'}
                    onClick={() => setElegida(f.venta.id)}
                  >
                    <td>
                      <button type="button" className="historial__fecha-celda" onClick={() => setElegida(f.venta.id)}>
                        <span className="historial__dia">{formatearFechaCorta(fecha)}</span>
                        <span className="historial__horario">{formatearHora(fecha)}</span>
                      </button>
                    </td>
                    <td className="historial__usuario">{f.vendedor}</td>
                    <td>{resumenItems(f.venta.items)}</td>
                    <td className="historial__usuario">{etiquetaMedio(f.venta.medio_pago)}</td>
                    <td className="historial__num historial__contado">{formatearMoneda(f.venta.total_cobrado)}</td>
                    <td className="historial__num">
                      <span className={`historial__diferencia pendientes__estado--${f.tono}`}>{f.estado}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filas.length === 0 && (
          <div className="historial__estado">
            <span>No hay ventas sin sincronizar.</span>
          </div>
        )}
      </div>

      {seleccionada && (
        <DetalleVenta
          fila={seleccionada}
          conexion={conexion}
          sincronizando={sincronizando}
          onCerrar={() => setElegida('')}
          onSincronizar={() => void sincronizar()}
          onReintentar={() => void reintentar(seleccionada.venta.id)}
          onDescartar={() => setADescartar(seleccionada.venta.id)}
          onAjustar={setAjuste}
          puedeAjustar={(item) => variantes?.has(item.variante_id) ?? false}
        />
      )}

      {diferencias.length > 0 && (
        <>
          <div className="historial__titulos">
            <h2 className="pendientes__subtitulo">Registradas con otro total</h2>
            <p className="historial__bajada">
              El precio cambió mientras la venta esperaba: el sistema la registró con el precio actual. Revisá la
              diferencia en la caja.
            </p>
          </div>
          <div className="historial__card">
            <div className="historial__scroll">
              <table className="historial__tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Venta</th>
                    <th className="historial__num">Cobrado</th>
                    <th className="historial__num">Registrado</th>
                    <th className="historial__num">Diferencia</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {diferencias.map((d) => {
                    const fecha = new Date(d.creada_en)
                    const diferencia = d.total_registrado - d.total_cobrado
                    return (
                      <tr key={d.id} className="historial__fila">
                        <td>
                          <span className="historial__fecha-celda">
                            <span className="historial__dia">{formatearFechaCorta(fecha)}</span>
                            <span className="historial__horario">{formatearHora(fecha)}</span>
                          </span>
                        </td>
                        <td className="historial__usuario">#{d.id.slice(0, 8).toUpperCase()}</td>
                        <td className="historial__num">{formatearMoneda(d.total_cobrado)}</td>
                        <td className="historial__num historial__contado">{formatearMoneda(d.total_registrado)}</td>
                        <td className="historial__num">
                          <span
                            className={`historial__diferencia historial__diferencia--${diferencia > 0 ? 'sobra' : 'falta'}`}
                          >
                            {diferencia > 0 ? '+ ' : '− '}
                            {formatearMoneda(Math.abs(diferencia))}
                          </span>
                        </td>
                        <td className="historial__num">
                          <button type="button" className="boton-secundario" onClick={() => void marcarDiferenciaVista(d.id)}>
                            Entendido
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {aDescartar && (
        <ConfirmarDescarteModal
          onVolver={() => setADescartar(null)}
          onConfirmar={() => {
            void descartarVenta(aDescartar)
            setADescartar(null)
            setElegida(null)
          }}
        />
      )}

      {ajuste && datosAjuste && (
        <AjusteStockModal
          productoNombre={ajuste.producto_nombre}
          fotoUrl={datosAjuste.fotoUrl}
          variante={datosAjuste.variante}
          onCerrar={() => setAjuste(null)}
          onAjustado={() => {
            setAjuste(null)
            void refrescarCatalogo().catch(() => undefined)
          }}
        />
      )}
    </div>
  )
}
