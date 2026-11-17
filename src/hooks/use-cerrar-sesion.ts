import { useCallback, useState } from 'react'
import { useAuth } from '../auth/use-auth'

interface CerrarSesion {
  cerrarSesion: () => Promise<void>
  saliendo: boolean
}

/** "Cerrar sesión" del menú de usuario y de la Apertura de Caja. */
export function useCerrarSesion(): CerrarSesion {
  const { logout } = useAuth()
  const [saliendo, setSaliendo] = useState(false)

  const cerrarSesion = useCallback(async () => {
    setSaliendo(true)
    // Al quedar sin sesión, <RequireAuth> redirige solo a /login
    await logout()
  }, [logout])

  return { cerrarSesion, saliendo }
}
