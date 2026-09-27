import { useCallback, useEffect, useState } from 'react'

type Resultado<T> = { version: number } & ({ ok: true; datos: T } | { ok: false })

export interface EstadoConsulta<T> {
  /** Último resultado exitoso (se conserva mientras se recarga). */
  datos: T | undefined
  /** true si la última consulta falló. */
  error: boolean
  /** true mientras la consulta vigente no volvió. */
  cargando: boolean
  recargar: () => void
}

/**
 * Ejecuta una consulta a Supabase al montar y cada vez que se llama a `recargar()`.
 * `consultar` debe ser estable (función de módulo o useCallback).
 */
export function useConsulta<T>(consultar: () => Promise<T>): EstadoConsulta<T> {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const [ultimosDatos, setUltimosDatos] = useState<T | undefined>(undefined)

  useEffect(() => {
    let cancelado = false
    consultar().then(
      (datos) => {
        if (cancelado) return
        setResultado({ version, ok: true, datos })
        setUltimosDatos(datos)
      },
      () => {
        if (!cancelado) setResultado({ version, ok: false })
      },
    )
    return () => {
      cancelado = true
    }
  }, [consultar, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  return {
    datos: ultimosDatos,
    error: resultado !== null && !resultado.ok,
    cargando: resultado?.version !== version,
    recargar,
  }
}
