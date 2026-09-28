import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { obtenerCajaActual, type CajaActual } from '../lib/caja'
import { guardarCaja, leerCajaGuardada } from '../lib/db-local'
import { CajaContext, type CajaContextValue } from './caja-context'

/**
 * Layout de rutas que mantiene el estado de la caja abierta (un solo mostrador: hay como
 * máximo una, la haya abierto quien sea). Va dentro de <RequireAuth>: se desmonta al
 * cerrar sesión y el próximo login arranca de cero.
 *
 * Sin conexión usa la última caja guardada en la base local (Módulo 11): la apertura
 * requiere conexión, así que si había una caja abierta su id ya estaba guardado.
 */
export function CajaProvider() {
  const [caja, setCaja] = useState<CajaActual | null | undefined>(undefined)
  const [error, setError] = useState(false)
  const [deCache, setDeCache] = useState(false)
  const { sesionOffline } = useAuth()

  const consultar = useCallback(async () => {
    const actual = await obtenerCajaActual()
    setCaja(actual)
    setError(false)
    setDeCache(false)
    void guardarCaja(actual)
    return actual
  }, [])

  useEffect(() => {
    let cancelado = false

    async function usarGuardada() {
      const guardada = await leerCajaGuardada()
      if (cancelado) return
      if (guardada === undefined) {
        setError(true)
      } else {
        setCaja(guardada)
        setDeCache(true)
      }
    }

    // En sesión offline ni se consulta: saldría sin token válido (y esperaría a que
    // supabase-js termine de reintentar la renovación). Al salir de ese modo se consulta.
    if (sesionOffline) {
      void usarGuardada()
    } else {
      obtenerCajaActual().then(
        (actual) => {
          if (cancelado) return
          setCaja(actual)
          setError(false)
          setDeCache(false)
          void guardarCaja(actual)
        },
        () => void usarGuardada(),
      )
    }
    return () => {
      cancelado = true
    }
  }, [sesionOffline])

  const refrescar = useCallback(async () => {
    try {
      return await consultar()
    } catch (e) {
      // Si falla un refresco en segundo plano se sigue mostrando el último dato conocido
      setError(true)
      throw e
    }
  }, [consultar])

  // Caja tomada de la base local: se confirma contra el servidor al reconectar. En sesión
  // offline no: lo hace el efecto de arriba cuando la sesión se renueva.
  useEffect(() => {
    if (!deCache || sesionOffline) return
    const alReconectar = () => void consultar().catch(() => undefined)
    window.addEventListener('online', alReconectar)
    return () => window.removeEventListener('online', alReconectar)
  }, [deCache, sesionOffline, consultar])

  // Vuelve a "sin consultar" y no a null: null mandaría a /apertura-caja antes de salir.
  // Solo se llama después de cerrar la caja: en la base local ya no hay caja abierta.
  const limpiar = useCallback(() => {
    setCaja(undefined)
    setError(false)
    setDeCache(false)
    void guardarCaja(null)
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
