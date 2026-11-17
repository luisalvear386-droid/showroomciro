import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { useCaja } from '../caja/use-caja'
import { AvisoSinConexion } from '../components/estado-conexion'
import { useEnLinea } from '../hooks/use-en-linea'
import { useEsMobile } from '../hooks/use-es-mobile'
import { cerrarCaja } from '../lib/caja'
import { formatearFechaLarga, formatearHora, formatearMoneda, parsearMonto } from '../lib/formato'
import { ConfirmarModal } from '../components/confirmar-modal'
import './caja-cierre-page.css'

interface ConfirmarCierreModalProps {
  montoContado: number
  onVolver: () => void
  /** Cierra la caja; si falla, devuelve el mensaje de error y la sesión sigue abierta. */
  onConfirmar: () => Promise<string | null>
}

/** Si sale bien, la pantalla se desmonta al cerrar la sesión. */
function ConfirmarCierreModal({ montoContado, onVolver, onConfirmar }: ConfirmarCierreModalProps) {
  return (
    <ConfirmarModal
      titulo="¿Cerrar la caja?"
      textoConfirmar="Cerrar Caja"
      textoEnviando="Cerrando caja…"
      onCancelar={onVolver}
      onConfirmar={onConfirmar}
    >
      <p className="confirmar-modal__texto">
        Vas a cerrar la caja con <strong>{formatearMoneda(montoContado)}</strong> contados en efectivo. El conteo no se
        puede editar después.
      </p>
      <p className="confirmar-modal__aviso">
        <span className="confirmar-modal__aviso-punto" aria-hidden="true" />
        Al confirmar, tu sesión se cerrará automáticamente.
      </p>
    </ConfirmarModal>
  )
}

/**
 * Caja — Cierre, según prototipos/Caja Cierre.dc.html.
 *
 * Desvío del prototipo: el cierre es a conteo ciego (decisión del Módulo 2, ver design.md).
 * No se muestran el efectivo vendido, el monto esperado ni la diferencia antes de confirmar;
 * `cerrar_caja()` los calcula y quedan en el Historial. Tampoco va la "Nota sobre la
 * diferencia": `cajas` no tiene dónde guardarla. Sin conexión no se puede cerrar.
 */
export function CajaCierrePage() {
  const { logout } = useAuth()
  const { caja, limpiar } = useCaja()
  const enLinea = useEnLinea()
  const esMobile = useEsMobile()
  const navigate = useNavigate()

  const [contado, setContado] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [montoAConfirmar, setMontoAConfirmar] = useState<number | null>(null)

  // Desde el celular no se opera caja (requirements.md §8); sin caja abierta no hay nada que cerrar
  if (esMobile || !caja) return <Navigate to="/" replace />
  const cajaId = caja.caja_id

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!enLinea) return
    const monto = parsearMonto(contado)
    if (monto === null) {
      setError('Ingresá un monto válido (ej. 127.300).')
      return
    }
    setMontoAConfirmar(monto)
  }

  async function confirmarCierre(montoContado: number): Promise<string | null> {
    const resultado = await cerrarCaja(cajaId, montoContado)
    // Si la RPC falla, la sesión sigue abierta y se muestra el error en el modal
    if (!resultado.ok) return resultado.error

    await logout()
    limpiar()
    navigate('/login', { replace: true })
    return null
  }

  const apertura = new Date(caja.fecha_apertura)
  const tieneConteo = contado.trim() !== ''

  return (
    <div className="cierre">
      <div className="cierre__encabezado">
        <div className="cierre__titulos">
          <h1 className="cierre__titulo">Cierre de Caja</h1>
          <p className="cierre__bajada">
            {formatearFechaLarga(apertura)} · abierta a las {formatearHora(apertura)}
          </p>
        </div>
      </div>

      <div className="cierre__columnas">
        <section className="cierre__card">
          <span className="cierre__card-titulo">Ventas del día</span>
          <div className="cierre__total">
            <span className="cierre__total-textos">
              <span className="cierre__total-etiqueta">Total vendido</span>
              <span className="cierre__total-detalle">
                {caja.cantidad_ventas} {caja.cantidad_ventas === 1 ? 'venta' : 'ventas'}
              </span>
            </span>
            <span className="cierre__total-valor">{formatearMoneda(caja.total_vendido)}</span>
          </div>
        </section>

        <form className="cierre__card" onSubmit={onSubmit} noValidate>
          <span className="cierre__card-titulo">Conteo físico</span>

          <div className="cierre__campo">
            <label htmlFor="contado" className="cierre__label">
              Efectivo contado en caja
            </label>
            <div className="cierre__monto">
              <span className="cierre__moneda" aria-hidden="true">
                $
              </span>
              <input
                id="contado"
                name="contado"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="0"
                className="cierre__input"
                value={contado}
                onChange={(e) => {
                  setContado(e.target.value)
                  setError(null)
                }}
                aria-invalid={error !== null}
              />
            </div>
            <span className="cierre__ayuda">
              Contá billetes y monedas antes de cerrar. El conteo no se puede editar después.
            </span>
          </div>

          {error && (
            <div className="mensaje-error" role="alert">
              {error}
            </div>
          )}

          <AvisoSinConexion />

          <p className="cierre__aviso">Al cerrar la caja, tu sesión se cerrará automáticamente.</p>

          <div className="cierre__botones">
            <button type="button" className="boton-cancelar" onClick={() => navigate('/')}>
              Cancelar
            </button>
            <button type="submit" className="boton-primario cierre__cerrar" disabled={!tieneConteo || !enLinea}>
              Cerrar Caja
            </button>
          </div>
        </form>
      </div>

      {montoAConfirmar !== null && (
        <ConfirmarCierreModal
          montoContado={montoAConfirmar}
          onVolver={() => setMontoAConfirmar(null)}
          onConfirmar={() => confirmarCierre(montoAConfirmar)}
        />
      )}
    </div>
  )
}
