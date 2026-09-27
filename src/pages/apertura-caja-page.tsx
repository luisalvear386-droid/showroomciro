import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { useCaja } from '../caja/use-caja'
import { PantallaCarga } from '../components/pantalla-carga'
import { abrirCaja } from '../lib/caja'
import { formatearFechaLarga, parsearMonto } from '../lib/formato'
import './apertura-caja-page.css'

const MONTOS_SUGERIDOS = [5000, 10000, 20000, 30000]
const MENSAJE_MONTO_VACIO = 'Ingresá el monto inicial para abrir la caja.'
const MENSAJE_MONTO_INVALIDO = 'Ingresá un monto válido (ej. 20.000).'

/** Pantalla bloqueante post-login — según prototipos/Apertura de Caja.dc.html */
export function AperturaCajaPage() {
  const { perfil, logout } = useAuth()
  const { caja, error: errorCaja, refrescar } = useCaja()
  const navigate = useNavigate()

  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  if (errorCaja) {
    return (
      <PantallaCarga mensaje="No se pudo consultar el estado de la caja. Revisá la conexión e intentá de nuevo.">
        <button type="button" className="boton-secundario" onClick={() => void refrescar().catch(() => undefined)}>
          Reintentar
        </button>
      </PantallaCarga>
    )
  }
  if (caja === undefined) return <PantallaCarga />
  // Ya hay una caja abierta (por este u otro usuario): este paso se saltea
  if (caja !== null && !enviando) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!monto.trim()) {
      setError(MENSAJE_MONTO_VACIO)
      return
    }
    const montoInicial = parsearMonto(monto)
    if (montoInicial === null) {
      setError(MENSAJE_MONTO_INVALIDO)
      return
    }

    setEnviando(true)
    setError(null)
    const resultado = await abrirCaja(montoInicial)

    if (!resultado.ok && !resultado.yaAbierta) {
      setEnviando(false)
      setError(resultado.error)
      return
    }

    // Abierta ahora o por otro usuario en paralelo: en los dos casos se sigue al Dashboard
    try {
      await refrescar()
      navigate('/', { replace: true })
    } catch {
      setEnviando(false)
      setError('La caja se abrió, pero no se pudo actualizar la pantalla. Recargá la página.')
    }
  }

  async function cerrarSesion() {
    setSaliendo(true)
    // Al quedar sin sesión, <RequireAuth> redirige solo a /login
    await logout()
  }

  function elegirSugerido(valor: number) {
    setMonto(valor.toLocaleString('es-AR'))
    setError(null)
    document.getElementById('monto')?.focus()
  }

  return (
    <div className="apertura">
      <div className="apertura__contenedor">
        <div className="apertura__encabezado">
          <span className="apertura__marca">ShowroomCiro</span>
          <span className="apertura__paso">Paso 1 de 1</span>
        </div>

        <div className="apertura__card">
          <form className="apertura__form" onSubmit={onSubmit} noValidate>
            <div className="apertura__titulos">
              <h1 className="apertura__titulo">Apertura de Caja</h1>
              <p className="apertura__bajada">
                Contá el efectivo con el que arrancás el día y anotá el monto. Después de esto ya podés vender.
              </p>
            </div>

            <div className="apertura__contexto">
              <span className="apertura__fecha">{formatearFechaLarga(new Date())}</span>
              <span className="apertura__separador" aria-hidden="true" />
              <span>
                Abre <strong>{perfil?.nombre_usuario}</strong>
              </span>
            </div>

            <div className="apertura__campo">
              <label htmlFor="monto" className="apertura__label">
                Monto inicial en efectivo
              </label>
              <div className="apertura__monto">
                <span className="apertura__moneda" aria-hidden="true">
                  $
                </span>
                <input
                  id="monto"
                  name="monto"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  placeholder="0"
                  className="apertura__input"
                  value={monto}
                  onChange={(e) => {
                    setMonto(e.target.value)
                    setError(null)
                  }}
                  disabled={enviando}
                  aria-invalid={error !== null}
                />
              </div>
              <div className="apertura__sugerencias">
                {MONTOS_SUGERIDOS.map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    className="apertura__sugerencia"
                    onClick={() => elegirSugerido(valor)}
                    disabled={enviando}
                  >
                    $ {valor.toLocaleString('es-AR')}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="apertura__error" role="alert">
                <span className="apertura__error-punto" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="apertura__abrir" disabled={enviando}>
              {enviando ? 'Abriendo…' : 'Abrir Caja'}
            </button>
          </form>
        </div>

        <p className="apertura__ayuda">La caja se abre una vez por día. Si ya la abrió otro usuario, este paso se saltea.</p>

        {/* No está en el prototipo: salida si alguien entró por error o tiene que cambiar de usuario */}
        <p className="apertura__salir">
          ¿No sos {perfil?.nombre_usuario}?{' '}
          <button
            type="button"
            className="apertura__salir-boton"
            onClick={() => void cerrarSesion()}
            disabled={enviando || saliendo}
          >
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
