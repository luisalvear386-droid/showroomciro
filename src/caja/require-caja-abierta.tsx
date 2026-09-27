import { Navigate, Outlet } from 'react-router'
import { useTieneRol } from '../auth/use-auth'
import { PantallaCarga } from '../components/pantalla-carga'
import { useEsMobile } from '../hooks/use-es-mobile'
import { useCaja } from './use-caja'

/**
 * Apertura de Caja bloqueante: sin caja abierta, cualquier ruta del sistema manda a
 * /apertura-caja.
 *
 * Excepción: el Dueño/a desde el celular. El acceso mobile es remoto y de solo consulta
 * ("no permite operar caja desde el celular", requirements.md), así que ahí no se le pide
 * abrir caja: entra al Dashboard y ve la caja como cerrada.
 */
export function RequireCajaAbierta() {
  const { caja, error, refrescar } = useCaja()
  const esDueno = useTieneRol('dueño')
  const esMobile = useEsMobile()

  if (error) {
    return (
      <PantallaCarga mensaje="No se pudo consultar el estado de la caja. Revisá la conexión e intentá de nuevo.">
        <button type="button" className="boton-secundario" onClick={() => void refrescar().catch(() => undefined)}>
          Reintentar
        </button>
      </PantallaCarga>
    )
  }

  if (caja === undefined) return <PantallaCarga />

  if (caja === null && !(esDueno && esMobile)) {
    return <Navigate to="/apertura-caja" replace />
  }

  return <Outlet />
}
