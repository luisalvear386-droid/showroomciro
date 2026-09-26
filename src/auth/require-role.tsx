import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import type { Rol } from '../lib/auth'
import { useTieneRol } from './use-auth'

interface RequireRoleProps {
  /** Roles con acceso permitido. */
  roles: Rol[]
  /** Qué mostrar si el rol no alcanza. Por defecto redirige a "/". */
  fallback?: ReactNode
  /** Si se omite, actúa como layout de rutas y renderiza <Outlet />. */
  children?: ReactNode
}

/**
 * Guard de rol del frontend. Es un complemento de UX: la seguridad real la imponen
 * las políticas RLS en Postgres. Sirve para no mostrar pantallas que igual fallarían al guardar.
 *
 * Debe usarse dentro de <RequireAuth>, que garantiza que el perfil ya está cargado.
 *
 * Uso como layout:   <Route element={<RequireRole roles={['dueño']} />}> ... </Route>
 * Uso como wrapper:  <RequireRole roles={['dueño']} fallback={null}><BotonReportes /></RequireRole>
 */
export function RequireRole({ roles, fallback, children }: RequireRoleProps) {
  const permitido = useTieneRol(...roles)

  if (!permitido) {
    return fallback !== undefined ? <>{fallback}</> : <Navigate to="/" replace />
  }

  return children !== undefined ? <>{children}</> : <Outlet />
}
