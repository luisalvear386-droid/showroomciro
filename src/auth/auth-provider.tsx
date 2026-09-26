import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { obtenerPerfil, type Perfil } from '../lib/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

interface PerfilCargado {
  userId: string
  perfil: Perfil | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = todavía no sabemos si hay sesión (primer evento de Supabase pendiente)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfilCargado, setPerfilCargado] = useState<PerfilCargado | null>(null)

  useEffect(() => {
    // onAuthStateChange emite INITIAL_SESSION al suscribirse, así que cubre la sesión persistida
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelado = false

    obtenerPerfil(userId)
      .then((perfil) => {
        if (cancelado) return
        if (!perfil || !perfil.activo) {
          // Sesión válida en Auth pero sin perfil activo: no se le permite operar
          void supabase.auth.signOut()
          return
        }
        setPerfilCargado({ userId, perfil })
      })
      .catch(() => {
        if (!cancelado) setPerfilCargado({ userId, perfil: null })
      })

    return () => {
      cancelado = true
    }
  }, [userId])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const perfil = userId && perfilCargado?.userId === userId ? perfilCargado.perfil : null
    const cargando = session === undefined || (userId !== null && perfilCargado?.userId !== userId)
    return {
      usuario: session?.user ?? null,
      perfil,
      rol: perfil?.rol ?? null,
      cargando,
      logout,
    }
  }, [session, userId, perfilCargado, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
