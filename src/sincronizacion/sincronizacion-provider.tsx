import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { useNavegadorEnLinea } from '../hooks/use-navegador-en-linea'
import { sincronizarCola, type ResultadoSincronizacion } from '../lib/cola-ventas'
import { db } from '../lib/db-local'
import { SincronizacionContext, type SincronizacionContextValue } from './sincronizacion-context'

/** Espera antes de reintentar después de cada sincronización fallida seguida (tope: la última). */
const ESPERAS_REINTENTO_MS = [5000, 30000, 120000]
const DEMORA_DISPARO_MS = 300

/**
 * Sincronización automática de la cola de ventas del mostrador (Módulo 11). Va dentro de
 * <RequireAuth>: sincroniza las ventas del usuario logueado, nunca las de otro (la base
 * registra cada venta a nombre de quien la envía).
 *
 * Se dispara al haber ventas pendientes (al entrar, o cuando se encola una nueva), al volver
 * la red y al renovarse la sesión; si falla, reintenta con espera creciente (salvo que la
 * base haya rechazado la sesión: ahí espera a que cambie algo, como un nuevo login).
 */
export function SincronizacionProvider() {
  const { usuario, sesionOffline } = useAuth()
  const usuarioId = usuario?.id ?? null

  const pendientes = useLiveQuery(
    () =>
      usuarioId
        ? db.ventasPendientes
            .where('usuario_id')
            .equals(usuarioId)
            .filter((v) => v.estado === 'pendiente')
            .count()
            .catch(() => 0)
        : 0,
    [usuarioId],
    0,
  )
  // Resto de la cola (todas las ventas, de cualquier usuario) y ventas con otro total
  const resto = useLiveQuery(
    async () => {
      const [cola, diferencias] = await Promise.all([
        db.ventasPendientes.toArray(),
        usuarioId ? db.ventasConDiferencia.where('usuario_id').equals(usuarioId).count() : 0,
      ]).catch(() => [[], 0] as const)
      return {
        conError: cola.filter((v) => v.usuario_id === usuarioId && v.estado === 'con_error').length,
        deOtros: cola.filter((v) => v.usuario_id !== usuarioId).length,
        conDiferencia: diferencias,
      }
    },
    [usuarioId],
  )
  const navegadorEnLinea = useNavegadorEnLinea()
  const [enCurso, setEnCurso] = useState(0)
  const [ultimo, setUltimo] = useState<ResultadoSincronizacion | null>(null)
  const [fallosSeguidos, setFallosSeguidos] = useState(0)

  const sincronizar = useCallback(
    async ({ esperar = false }: { esperar?: boolean } = {}): Promise<ResultadoSincronizacion> => {
      // En sesión offline no hay token válido: se sincroniza cuando se renueve
      if (!usuarioId || sesionOffline) return { estado: 'sin-sesion', registradas: 0, conError: 0 }

      setEnCurso((n) => n + 1)
      let resultado: ResultadoSincronizacion
      try {
        resultado = await sincronizarCola(usuarioId, { esperar })
      } catch (error) {
        // Falla de la base local o inesperada: se trata como un corte, se reintenta
        console.warn('No se pudo sincronizar la cola de ventas.', error)
        resultado = { estado: 'sin-conexion', registradas: 0, conError: 0 }
      } finally {
        setEnCurso((n) => n - 1)
      }
      if (resultado.estado !== 'ocupado') {
        setUltimo(resultado)
        setFallosSeguidos((n) => (resultado.estado === 'ok' ? 0 : n + 1))
      }
      return resultado
    },
    [usuarioId, sesionOffline],
  )

  // La base rechazó la sesión: nada automático hasta que cambie la sesión (el provider se
  // desmonta al salir). Cada pasada marcaría "con error" otra venta.
  const sesionRechazada = ultimo?.estado === 'sesion-rechazada'

  // Hay ventas esperando (al entrar, al encolarse una nueva o al renovarse la sesión).
  // Con una pausa corta: mientras la cola se vacía, la cuenta cambia varias veces seguidas.
  useEffect(() => {
    if (pendientes === 0 || sesionRechazada) return
    const temporizador = window.setTimeout(() => void sincronizar(), DEMORA_DISPARO_MS)
    return () => window.clearTimeout(temporizador)
  }, [pendientes, sesionRechazada, sincronizar])

  // Volvió la red: la espera entre reintentos arranca de nuevo desde la más corta
  useEffect(() => {
    if (pendientes === 0 || sesionRechazada) return
    const alReconectar = () => {
      setFallosSeguidos(0)
      void sincronizar()
    }
    window.addEventListener('online', alReconectar)
    return () => window.removeEventListener('online', alReconectar)
  }, [pendientes, sesionRechazada, sincronizar])

  // No se pudo: se reintenta con espera creciente mientras queden pendientes
  useEffect(() => {
    if (pendientes === 0 || ultimo === null || sesionOffline || sesionRechazada) return
    if (ultimo.estado === 'ok') return
    const espera = ESPERAS_REINTENTO_MS[Math.min(fallosSeguidos, ESPERAS_REINTENTO_MS.length) - 1] ?? ESPERAS_REINTENTO_MS[0]
    const temporizador = window.setTimeout(() => void sincronizar(), espera)
    return () => window.clearTimeout(temporizador)
  }, [pendientes, ultimo, fallosSeguidos, sesionOffline, sesionRechazada, sincronizar])

  const sinConexion =
    !navegadorEnLinea || sesionOffline || (ultimo?.estado === 'sin-conexion' && pendientes > 0)

  const value = useMemo<SincronizacionContextValue>(
    () => ({
      pendientes,
      conError: resto?.conError ?? 0,
      deOtros: resto?.deOtros ?? 0,
      conDiferencia: resto?.conDiferencia ?? 0,
      conexion: sinConexion ? 'sin-conexion' : 'en-linea',
      sincronizando: enCurso > 0,
      ultimo,
      sincronizar,
    }),
    [pendientes, resto, sinConexion, enCurso, ultimo, sincronizar],
  )

  return (
    <SincronizacionContext.Provider value={value}>
      <Outlet />
    </SincronizacionContext.Provider>
  )
}
