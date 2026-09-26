import { useContext } from 'react'
import type { Rol } from '../lib/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return ctx
}

/** true si el usuario logueado tiene alguno de los roles indicados. */
export function useTieneRol(...roles: Rol[]): boolean {
  const { rol } = useAuth()
  return rol !== null && roles.includes(rol)
}
