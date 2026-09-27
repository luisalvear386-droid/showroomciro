import { useContext } from 'react'
import { CajaContext, type CajaContextValue } from './caja-context'

export function useCaja(): CajaContextValue {
  const ctx = useContext(CajaContext)
  if (!ctx) throw new Error('useCaja debe usarse dentro de <CajaProvider>.')
  return ctx
}
