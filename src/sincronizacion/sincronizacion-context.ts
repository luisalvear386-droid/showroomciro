import { createContext } from 'react'
import type { ResultadoSincronizacion } from '../lib/cola-ventas'

export interface SincronizacionContextValue {
  /** Ventas del usuario logueado que esperan turno para registrarse (sin contar las con error). */
  pendientes: number
  /** true mientras hay una sincronización en curso. */
  sincronizando: boolean
  /** Resultado de la última sincronización, o null si todavía no corrió ninguna. */
  ultimo: ResultadoSincronizacion | null
  /**
   * Sincroniza ya. `esperar`: si hay otra en curso, espera a que termine y vuelve a pasar
   * (para cuando hace falta un resultado definitivo, como el cierre de caja).
   */
  sincronizar: (opciones?: { esperar?: boolean }) => Promise<ResultadoSincronizacion>
}

export const SincronizacionContext = createContext<SincronizacionContextValue | null>(null)
