import { createContext } from 'react'
import type { ResultadoSincronizacion } from '../lib/cola-ventas'

export interface SincronizacionContextValue {
  /** Ventas del usuario logueado que esperan turno para registrarse (sin contar las con error). */
  pendientes: number
  /** Ventas del usuario logueado que la base rechazó: esperan que alguien las resuelva. */
  conError: number
  /** Ventas de otros usuarios sin registrar: se sincronizan cuando entre ese usuario. */
  deOtros: number
  /** Ventas del usuario registradas con otro total que el cobrado, todavía sin revisar. */
  conDiferencia: number
  /**
   * Sin conexión si el navegador lo dice, si la sesión es offline, o si la última
   * sincronización falló por red (y todavía hay pendientes). Con red local sin internet y
   * nada pendiente puede decir "en línea" hasta que falle un envío.
   */
  conexion: 'en-linea' | 'sin-conexion'
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
