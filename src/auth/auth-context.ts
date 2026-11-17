import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Perfil, Rol } from '../lib/auth'

export interface AuthContextValue {
  /** Usuario de Supabase Auth, o null si no hay sesión. */
  usuario: User | null
  /** Perfil de la tabla `perfiles` (nombre_usuario, rol, activo). */
  perfil: Perfil | null
  rol: Rol | null
  /** true mientras se resuelve la sesión inicial o se carga el perfil. */
  cargando: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
