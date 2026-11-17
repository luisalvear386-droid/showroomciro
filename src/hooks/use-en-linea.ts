import { useSyncExternalStore } from 'react'
import { hayFalloRed, suscribirFalloRed } from '../lib/conexion'
import { useNavegadorEnLinea } from './use-navegador-en-linea'

/**
 * true si hay conexión con Supabase: el navegador tiene red y el último pedido no falló por
 * red (ver src/lib/conexion.ts). Sin conexión se bloquea todo lo que escribe en la base.
 */
export function useEnLinea(): boolean {
  const navegador = useNavegadorEnLinea()
  const falloRed = useSyncExternalStore(suscribirFalloRed, hayFalloRed, () => false)
  return navegador && !falloRed
}
