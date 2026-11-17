import type { ReactNode } from 'react'
import { PiePagina } from './pie-pagina'

interface PantallaCargaProps {
  mensaje?: string
  children?: ReactNode
}

export function PantallaCarga({ mensaje = 'Cargando…', children }: PantallaCargaProps) {
  return (
    <div className="pantalla-centrada" role="status" aria-live="polite">
      <p className="pantalla-centrada__mensaje">{mensaje}</p>
      {children}
      <PiePagina />
    </div>
  )
}

/**
 * Sin conexión no se puede arrancar (sesión, perfil y caja salen de Supabase). "Reintentar"
 * recarga la app: el Service Worker la sirve aunque no haya red.
 */
export function PantallaSinConexion() {
  return (
    <PantallaCarga mensaje="Sin conexión. La app necesita internet para funcionar: cuando vuelva, tocá Reintentar.">
      <button type="button" className="boton-secundario" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </PantallaCarga>
  )
}
