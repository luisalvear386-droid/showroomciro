import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/use-auth'
import { useCerrarSesion } from '../hooks/use-cerrar-sesion'
import type { Rol } from '../lib/auth'

const ETIQUETA_ROL: Record<Rol, string> = {
  dueño: 'Dueño/a',
  vendedor: 'Vendedor',
}

/** Bloque de usuario del header (nombre + rol). Al hacer clic despliega "Cerrar sesión". */
export function MenuUsuario() {
  const { perfil } = useAuth()
  const { pedirSalida, saliendo, aviso } = useCerrarSesion()
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alClicFuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', alClicFuera)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alClicFuera)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  if (!perfil) return null

  return (
    <div className="menu-usuario" ref={contenedor}>
      <button
        type="button"
        className="menu-usuario__boton"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <span className="menu-usuario__avatar" aria-hidden="true">
          {perfil.nombre_usuario.slice(0, 2).toUpperCase()}
        </span>
        <span className="menu-usuario__datos">
          <span className="menu-usuario__nombre">{perfil.nombre_usuario}</span>
          <span className="menu-usuario__rol">{ETIQUETA_ROL[perfil.rol]}</span>
        </span>
        <span className="menu-usuario__flecha" aria-hidden="true">
          ▾
        </span>
      </button>

      {abierto && (
        <div className="menu-usuario__desplegable" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-usuario__opcion"
            onClick={() => {
              setAbierto(false)
              void pedirSalida()
            }}
            disabled={saliendo}
          >
            <span className="menu-usuario__punto" aria-hidden="true" />
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      )}

      {aviso}
    </div>
  )
}
