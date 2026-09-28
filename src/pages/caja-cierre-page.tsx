import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { RequireRole } from '../auth/require-role'
import { useAuth } from '../auth/use-auth'
import { useCaja } from '../caja/use-caja'
import { useEsMobile } from '../hooks/use-es-mobile'
import { cerrarCaja } from '../lib/caja'
import { formatearFechaLarga, formatearHora, formatearMoneda, parsearMonto } from '../lib/formato'
import './caja-cierre-page.css'

interface ConfirmarCierreModalProps {
  montoContado: number
  onVolver: () => void
  /** Cierra la caja; si falla, devuelve el mensaje de error y la sesión sigue abierta. */
  onConfirmar: () => Promise<string | null>
}

function ConfirmarCierreModal({ montoContado, onVolver, onConfirmar }: ConfirmarCierreModalProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onVolver()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [enviando, onVolver])

  async function confirmar() {
    setEnviando(true)
    setError(null)
    const mensaje = await onConfirmar()
    // Si salió bien, la pantalla se desmonta al cerrar la sesión
    if (mensaje !== null) {
      setError(mensaje)
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fondo" onClick={() => !enviando && onVolver()}>
      <div
        className="confirmar-cierre"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-cierre-titulo"
        aria-describedby="confirmar-cierre-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirmar-cierre-titulo" className="confirmar-cierre__titulo">
          ¿Cerrar la caja?
        </h2>
        <div id="confirmar-cierre-texto" className="confirmar-cierre__textos">
          <p className="confirmar-cierre__texto">
            Vas a cerrar la caja con <strong>{formatearMoneda(montoContado)}</strong> contados en efectivo. El conteo no
            se puede editar después.
          </p>
          <p className="confirmar-cierre__aviso">
            <span className="confirmar-cierre__aviso-punto" aria-hidden="true" />
            Al confirmar, tu sesión se cerrará automáticamente.
          </p>
        </div>

        {error && (
          <div className="mensaje-error" role="alert">
            {error}
          </div>
        )}

        <div className="confirmar-cierre__botones">
          <button type="button" className="boton-cancelar" onClick={onVolver} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario confirmar-cierre__confirmar"
            onClick={() => void confirmar()}
            disabled={enviando}
            autoFocus
          >
            {enviando ? 'Cerrando caja…' : 'Cerrar Caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Caja — Cierre, según prototipos/Caja Cierre.dc.html.
 *
 * Desvío del prototipo: el cierre es a conteo ciego (decisión del Módulo 2, ver design.md).
 * No se muestran el efectivo vendido, el monto esperado ni la diferencia antes de confirmar;
 * `cerrar_caja()` los calcula y quedan en el Historial. Tampoco va la "Nota sobre la
 * diferencia": `cajas` no tiene dónde guardarla.
 */
export function CajaCierrePage() {
  const { logout } = useAuth()
  const { caja, limpiar } = useCaja()
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
        <RequireRole roles={['dueño']} fallback={null}>
          <Link to="/caja/historial" className="cierre__historial">
            Ver historial
          </Link>
        </RequireRole>
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

          <p className="cierre__aviso">Al cerrar la caja, tu sesión se cerrará automáticamente.</p>

          <div className="cierre__botones">
            <button type="button" className="boton-cancelar" onClick={() => navigate('/')}>
              Cancelar
            </button>
            <button type="submit" className="boton-primario cierre__cerrar" disabled={!tieneConteo}>
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
