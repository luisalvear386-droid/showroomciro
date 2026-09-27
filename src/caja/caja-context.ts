import { createContext } from 'react'
import type { CajaActual } from '../lib/caja'

export interface CajaContextValue {
  /** undefined = todavía no se consultó; null = no hay ninguna caja abierta. */
  caja: CajaActual | null | undefined
  /** true si la última consulta falló y no hay un dato previo para mostrar. */
  error: boolean
  /** Vuelve a consultar `caja_actual_resumen()` y devuelve el resultado. */
  refrescar: () => Promise<CajaActual | null>
}

export const CajaContext = createContext<CajaContextValue | null>(null)
