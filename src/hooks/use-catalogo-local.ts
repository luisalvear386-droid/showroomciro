import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/use-auth'
import { aplicarPendientes, ordenarCatalogo, refrescarCatalogo } from '../lib/catalogo-local'
import { db, type VentaPendiente } from '../lib/db-local'
import type { ProductoListado } from '../lib/productos'
import { useConsulta } from './use-consulta'

const SIN_PENDIENTES: VentaPendiente[] = []

export interface CatalogoLocal {
  /** Catálogo con el stock que ve el mostrador (descontada la cola). undefined = todavía no hay. */
  productos: ProductoListado[] | undefined
  /** true si no se pudo bajar el catálogo y tampoco hay uno guardado. */
  error: boolean
  /** true si no se pudo bajar el catálogo y se muestra el último guardado. */
  desactualizado: boolean
  recargar: () => void
}

/**
 * Catálogo del POS (Módulo 11): muestra enseguida el guardado en la base local y lo refresca
 * contra Supabase en segundo plano. Sin conexión queda el guardado.
 */
export function useCatalogoLocal(): CatalogoLocal {
  // null = no se pudo leer la base local (se usa lo bajado en esta sesión)
  const guardados = useLiveQuery(
    () =>
      db.productos
        .toArray()
        .then(ordenarCatalogo)
        .catch(() => null),
    [],
  )
  const pendientes = useLiveQuery(() => db.ventasPendientes.toArray().catch(() => SIN_PENDIENTES), [], SIN_PENDIENTES)
  // En sesión offline no se refresca (ver refrescarCatalogo); al renovarse la sesión cambia
  // la función y useConsulta vuelve a consultar sola
  const { sesionOffline } = useAuth()
  const consultar = useCallback(
    () => (sesionOffline ? Promise.reject(new Error('Sesión offline')) : refrescarCatalogo()),
    [sesionOffline],
  )
  const refresco = useConsulta(consultar)

  const base = useMemo(() => {
    if (guardados && guardados.length > 0) return guardados
    return refresco.datos ? ordenarCatalogo(refresco.datos) : undefined
  }, [guardados, refresco.datos])

  const productos = useMemo(() => base && aplicarPendientes(base, pendientes), [base, pendientes])

  return {
    productos,
    error: refresco.error && base === undefined,
    desactualizado: refresco.error && base !== undefined,
    recargar: refresco.recargar,
  }
}
