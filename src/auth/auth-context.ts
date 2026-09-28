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
  /**
   * true si se arrancó sin red con el token vencido: se opera con el usuario de la sesión
   * guardada (y su perfil de la base local) hasta que se pueda renovar. Mientras tanto,
   * cualquier llamada a Supabase sale sin token válido.
   */
  sesionOffline: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
