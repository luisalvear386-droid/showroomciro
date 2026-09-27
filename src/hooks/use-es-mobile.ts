import { useSyncExternalStore } from 'react'

/** Mismo corte que usa el CSS del layout para pasar del sidebar al menú inferior. */
const CONSULTA_MOBILE = '(max-width: 768px)'

function suscribir(avisar: () => void) {
  const mql = window.matchMedia(CONSULTA_MOBILE)
  mql.addEventListener('change', avisar)
  return () => mql.removeEventListener('change', avisar)
}

function esMobileAhora() {
  return window.matchMedia(CONSULTA_MOBILE).matches
}

/** true si la pantalla es de celular (layout con menú inferior). */
export function useEsMobile(): boolean {
  return useSyncExternalStore(suscribir, esMobileAhora)
}
