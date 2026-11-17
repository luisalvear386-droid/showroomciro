import { Navigate, Outlet, useLocation } from 'react-router'
import { useEnLinea } from '../hooks/use-en-linea'
import { haySesionGuardada } from '../lib/auth'
import { useAuth } from './use-auth'
import { PantallaCarga, PantallaSinConexion } from '../components/pantalla-carga'

/** Layout de rutas protegidas: sin sesión activa redirige a /login recordando a dónde se quería ir. */
export function RequireAuth() {
  const { usuario, perfil, cargando, logout } = useAuth()
  const enLinea = useEnLinea()
  const location = useLocation()

  // Sin conexión al arrancar: ni el login (la sesión guardada se renueva cuando vuelva
  // internet) ni un error de perfil
  if (!enLinea && (cargando || !perfil || (!usuario && haySesionGuardada()))) return <PantallaSinConexion />

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
