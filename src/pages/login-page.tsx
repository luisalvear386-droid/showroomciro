import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { login } from '../lib/auth'
import { useAuth } from '../auth/use-auth'
import { PantallaCarga } from '../components/pantalla-carga'
import './login-page.css'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { usuario, perfil, cargando } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = (location.state as LocationState | null)?.from ?? '/'

  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (cargando && !enviando) return <PantallaCarga />
  if (usuario && perfil && !enviando) return <Navigate to={destino} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const nombreUsuario = String(form.get('usuario') ?? '')
    const clave = String(form.get('clave') ?? '')

    setEnviando(true)
    setError(null)
    const resultado = await login(nombreUsuario, clave)
    setEnviando(false)

    if (resultado.ok) {
      navigate(destino, { replace: true })
    } else {
      setError(resultado.error)
    }
  }

  return (
    <div className="login">
      <div className="login__contenedor">
        <div className="login__marca">
          <div className="login__logo" aria-hidden="true">
            logo
            <br />
            futuro
          </div>
          <div className="login__titulos">
            <h1 className="login__titulo">ShowroomCiro</h1>
            <p className="login__subtitulo">Sistema de gestión</p>
          </div>
        </div>

        <div className="login__card">
          <form className="login__form" onSubmit={onSubmit} noValidate>
            <div className="login__campo">
              <label htmlFor="usuario" className="login__label">
                Usuario
              </label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Tu nombre de usuario"
                className="login__input"
                disabled={enviando}
                required
              />
            </div>

            <div className="login__campo">
              <label htmlFor="clave" className="login__label">
                Contraseña
              </label>
              <div className="login__clave">
                <input
                  id="clave"
                  name="clave"
                  type={mostrarClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="login__input login__input--clave"
                  disabled={enviando}
                  required
                />
                <button
                  type="button"
                  className="login__ver-clave"
                  onClick={() => setMostrarClave((v) => !v)}
                  aria-label={mostrarClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarClave ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            {error && (
              <div className="login__error" role="alert">
                <span className="login__error-punto" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="login__ingresar" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="login__ayuda">Acceso interno del local. Si no recordás tu clave, pedísela al dueño.</p>
      </div>
    </div>
  )
}
