import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { obtenerCajaActual, type CajaActual } from '../lib/caja'
import { CajaContext, type CajaContextValue } from './caja-context'

/**
 * Layout de rutas que mantiene el estado de la caja abierta (un solo mostrador: hay como
 * máximo una, la haya abierto quien sea). Va dentro de <RequireAuth>: se desmonta al
 * cerrar sesión y el próximo login arranca de cero.
 */
export function CajaProvider() {
  const [caja, setCaja] = useState<CajaActual | null | undefined>(undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    obtenerCajaActual().then(
      (actual) => {
        if (cancelado) return
        setCaja(actual)
        setError(false)
      },
      () => {
        if (!cancelado) setError(true)
      },
    )
    return () => {
      cancelado = true
    }
  }, [])

  const refrescar = useCallback(async () => {
    try {
      const actual = await obtenerCajaActual()
      setCaja(actual)
      setError(false)
      return actual
    } catch (e) {
      // Si falla un refresco en segundo plano se sigue mostrando el último dato conocido
      setError(true)
      throw e
    }
  }, [])

  // Vuelve a "sin consultar" y no a null: null mandaría a /apertura-caja antes de salir
  const limpiar = useCallback(() => {
    setCaja(undefined)
    setError(false)
  }, [])

  const value = useMemo<CajaContextValue>(
    () => ({ caja, error: error && caja === undefined, refrescar, limpiar }),
    [caja, error, refrescar, limpiar],
  )

  return (
    <CajaContext.Provider value={value}>
      <Outlet />
    </CajaContext.Provider>
  )
}
