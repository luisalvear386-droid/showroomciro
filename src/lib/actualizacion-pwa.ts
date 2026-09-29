import { registerSW } from 'virtual:pwa-register'

/** Cada cuánto se pregunta si hay una versión nueva (el mostrador puede quedar abierto días). */
const INTERVALO_BUSQUEDA_MS = 60 * 60 * 1000

let hayVersionNueva = false
let enLogin = false

function aplicar(): void {
  if (hayVersionNueva && enLogin) window.location.reload()
}

/**
 * Registra el Service Worker de la PWA (Módulo 11).
 *
 * Una versión nueva se instala y se activa sola (`registerType: 'autoUpdate'`): desde ahí el
 * Service Worker sirve los archivos nuevos. La página abierta sigue con el código con el que
 * cargó (es un solo bundle, no pide partes nuevas después) y recién se recarga en la pantalla
 * de login (`marcarEnLogin`), nunca a mitad de una venta. Sin `onNeedReload` el plugin
 * recargaría apenas se activa.
 *
 * No se usa el modo "prompt" (esperar y activar con SKIP_WAITING al llegar al login): en las
 * pruebas del Módulo 11 el mensaje se enviaba pero el Service Worker en espera no se activaba
 * (causa no confirmada). Así no depende de ningún mensaje.
 * En `npm run dev` no hay Service Worker.
 */
export function registrarServiceWorker(): void {
  registerSW({
    onNeedReload() {
      hayVersionNueva = true
      aplicar()
    },
    onRegisteredSW(_url, registro) {
      if (!registro) return
      window.setInterval(() => {
        if (navigator.onLine) void registro.update()
      }, INTERVALO_BUSQUEDA_MS)
    },
  })
}

/**
 * La pantalla de login está a la vista: el turno terminó (cierre de caja o cierre de sesión) o
 * todavía no empezó. Si se activó una versión nueva, se recarga para usarla. Las ventas
 * pendientes no se pierden: están en IndexedDB. Devuelve la función para cuando se sale.
 */
export function marcarEnLogin(): () => void {
  enLogin = true
  aplicar()
  return () => {
    enLogin = false
  }
}
