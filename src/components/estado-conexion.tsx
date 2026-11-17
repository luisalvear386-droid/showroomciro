import { useEnLinea } from '../hooks/use-en-linea'
import './estado-conexion.css'

const TEXTO_SIN_CONEXION = 'Sin conexión: esperá a que vuelva internet.'

/** Pastilla coral del header: aparece solo mientras no hay conexión con Supabase. */
export function EstadoConexion() {
  const enLinea = useEnLinea()
  if (enLinea) return null
  return (
    <span className="estado-conexion" role="status">
      <span className="estado-conexion__punto" aria-hidden="true" />
      Sin conexión
    </span>
  )
}

/**
 * Línea debajo de un botón que queda deshabilitado sin conexión (vender, cobrar, abrir o
 * cerrar caja, guardar). No se muestra con conexión.
 */
export function AvisoSinConexion({ className }: { className?: string }) {
  const enLinea = useEnLinea()
  if (enLinea) return null
  return (
    <p className={className ? `aviso-sin-conexion ${className}` : 'aviso-sin-conexion'} role="status">
      {TEXTO_SIN_CONEXION}
    </p>
  )
}
