interface EnConstruccionPageProps {
  titulo: string
  modulo: number
}

/**
 * Placeholder temporal para las rutas del menú cuyas pantallas llegan en módulos
 * posteriores (ver docs/tasks.md). Se reemplaza al implementar cada una.
 */
export function EnConstruccionPage({ titulo, modulo }: EnConstruccionPageProps) {
  return (
    <div className="pantalla-centrada pantalla-centrada--interna">
      <p className="pantalla-centrada__mensaje">
        <strong>{titulo}</strong> se implementa en el Módulo {modulo}.
      </p>
    </div>
  )
}
