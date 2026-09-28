import { useCallback, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/use-auth'
import { ConfirmarSalidaModal } from '../components/confirmar-salida-modal'
import { contarSinRegistrar } from '../lib/cola-ventas'

interface CerrarSesion {
  /** Cierra la sesión, o primero avisa si el usuario tiene ventas sin sincronizar. */
  pedirSalida: () => Promise<void>
  saliendo: boolean
  /** El aviso, para renderizar donde se usa el hook (null si no hay que mostrarlo). */
  aviso: ReactNode
}

/**
 * "Cerrar sesión" del menú de usuario y de la Apertura de Caja (Módulo 11): con ventas del
 * usuario sin sincronizar avisa antes, porque solo se sincronizan con ese mismo usuario.
 * El cierre de caja no pasa por acá: no deja cerrar con ventas sin sincronizar.
 */
export function useCerrarSesion(): CerrarSesion {
  const { usuario, logout } = useAuth()
  const [sinRegistrar, setSinRegistrar] = useState<number | null>(null)
  const [saliendo, setSaliendo] = useState(false)

  const salir = useCallback(async () => {
    setSaliendo(true)
    // Al quedar sin sesión, <RequireAuth> redirige solo a /login
    await logout()
  }, [logout])

  const pedirSalida = useCallback(async () => {
    const cantidad = usuario ? await contarSinRegistrar(usuario.id).catch(() => 0) : 0
    if (cantidad > 0) setSinRegistrar(cantidad)
    else await salir()
  }, [usuario, salir])

  const volver = useCallback(() => setSinRegistrar(null), [])

  const aviso =
    sinRegistrar !== null ? (
      <ConfirmarSalidaModal
        cantidad={sinRegistrar}
        saliendo={saliendo}
        onVolver={volver}
        onConfirmar={() => void salir()}
      />
    ) : null

  return { pedirSalida, saliendo, aviso }
}
