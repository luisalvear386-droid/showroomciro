import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './use-auth'
import { PantallaCarga } from '../components/pantalla-carga'

/** Layout de rutas protegidas: sin sesión activa redirige a /login recordando a dónde se quería ir. */
export function RequireAuth() {
  const { usuario, perfil, cargando, logout } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCarga />

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!perfil) {
    return (
      <PantallaCarga mensaje="No se pudo cargar tu perfil. Revisá la conexión e intentá de nuevo.">
        <button type="button" className="boton-secundario" onClick={() => void logout()}>
          Volver al inicio de sesión
        </button>
      </PantallaCarga>
    )
  }

  return <Outlet />
}
