import { Navigate, Outlet } from 'react-router'
import { PantallaCarga } from '../components/pantalla-carga'
import { useEsMobile } from '../hooks/use-es-mobile'
import { useCaja } from './use-caja'

/**
 * Apertura de Caja bloqueante: sin caja abierta, cualquier ruta del sistema manda a
 * /apertura-caja.
 *
 * Excepción: el celular, para cualquier rol. El acceso mobile es de solo consulta ("no permite
 * operar caja desde el celular", requirements.md, extendido también al Vendedor), así que ahí no
 * se pide abrir caja: entra al Dashboard y ve la caja como cerrada.
 */
export function RequireCajaAbierta() {
  const { caja, error, refrescar } = useCaja()
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

  if (caja === null && !esMobile) {
    return <Navigate to="/apertura-caja" replace />
  }

  return <Outlet />
}
