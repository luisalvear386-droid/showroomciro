/**
 * Conexión con Supabase. Sin conexión no se vende ni se guarda nada (el modo offline quedó
 * descartado, ver design.md → "Modo offline (descartado por ahora)"): la app avisa y bloquea
 * las acciones que escriben en la base hasta que vuelva internet.
 *
 * `navigator.onLine` en false es confiable, en true no (puede haber wifi sin internet). Por
 * eso además se mira cada pedido a Supabase: si falla por red se marca "sin conexión" hasta
 * que un pedido vuelva a tener respuesta. Mientras tanto se sondea Supabase cada pocos
 * segundos, para enterarse de que volvió sin esperar a que el usuario intente algo.
 */

const URL_SONDEO = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
const INTERVALO_SONDEO_MS = 5000

let falloRed = false
let sondeo: number | undefined
const oyentes = new Set<() => void>()
const oyentesReconexion = new Set<() => void>()

/** Falla de red (sin respuesta) o el timeout que se le pone a la venta: no un error de la base. */
function esFallaDeRed(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
}

function marcarFalloRed(valor: boolean): void {
  if (falloRed === valor) return
  falloRed = valor
  if (falloRed) {
    sondeo = window.setInterval(sondear, INTERVALO_SONDEO_MS)
  } else {
    window.clearInterval(sondeo)
  }
  for (const avisar of oyentes) avisar()
  if (!falloRed && navigator.onLine) for (const avisar of oyentesReconexion) avisar()
}

/**
 * `fetch` del cliente de Supabase (REST, RPC, Auth y Storage): cualquier respuesta, aunque
 * sea un error de la base, dice que hay conexión.
 */
export async function fetchConAviso(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const respuesta = await fetch(input, init)
    marcarFalloRed(false)
    return respuesta
  } catch (error) {
    if (esFallaDeRed(error)) marcarFalloRed(true)
    throw error
  }
}

function sondear(): void {
  if (!navigator.onLine) return
  void fetchConAviso(URL_SONDEO, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    cache: 'no-store',
    signal: AbortSignal.timeout(INTERVALO_SONDEO_MS),
  }).catch(() => undefined)
}

// Volvió la red del navegador: se confirma enseguida que también volvió internet (con
// fallo de red pendiente, la reconexión se avisa recién cuando el sondeo tiene respuesta)
window.addEventListener('online', () => {
  if (falloRed) sondear()
  else for (const avisar of oyentesReconexion) avisar()
})

export function suscribirFalloRed(avisar: () => void): () => void {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

export function hayFalloRed(): boolean {
  return falloRed
}

/**
 * Avisa cada vez que vuelve la conexión, para reintentar lo que no se pudo cargar sin ella
 * (perfil, caja, catálogo del POS). Devuelve la función para dejar de escuchar.
 */
export function alVolverLaConexion(avisar: () => void): () => void {
  oyentesReconexion.add(avisar)
  return () => oyentesReconexion.delete(avisar)
}
