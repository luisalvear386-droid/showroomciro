import type { ReactNode } from 'react'

interface PantallaCargaProps {
  mensaje?: string
  children?: ReactNode
}

export function PantallaCarga({ mensaje = 'Cargando…', children }: PantallaCargaProps) {
  return (
    <div className="pantalla-centrada" role="status" aria-live="polite">
      <p className="pantalla-centrada__mensaje">{mensaje}</p>
      {children}
    </div>
  )
}
