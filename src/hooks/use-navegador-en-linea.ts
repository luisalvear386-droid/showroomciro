import { useSyncExternalStore } from 'react'

function suscribir(avisar: () => void): () => void {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/**
 * `navigator.onLine`: false es confiable (no hay red), true no (puede haber red local sin
 * internet). Por eso es solo una de las señales del estado de conexión.
 */
export function useNavegadorEnLinea(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true)
}
