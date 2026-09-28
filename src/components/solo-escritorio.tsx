import { Navigate, Outlet } from 'react-router'
import { useEsMobile } from '../hooks/use-es-mobile'

/**
 * Rutas que venden, operan caja o modifican datos: solo desde el mostrador.
 * El acceso mobile es remoto y de solo consulta (requirements.md, sección 8), así que en el
 * celular estas rutas vuelven al Dashboard aunque se entre escribiendo la URL. La única acción
 * real permitida en mobile, la gestión de usuarios, no pasa por este guard.
 */
export function SoloEscritorio() {
  const esMobile = useEsMobile()
  if (esMobile) return <Navigate to="/" replace />
  return <Outlet />
}
