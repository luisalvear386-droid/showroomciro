import { useContext } from 'react'
import { SincronizacionContext, type SincronizacionContextValue } from './sincronizacion-context'

export function useSincronizacion(): SincronizacionContextValue {
  const ctx = useContext(SincronizacionContext)
  if (!ctx) throw new Error('useSincronizacion debe usarse dentro de <SincronizacionProvider>.')
  return ctx
}
