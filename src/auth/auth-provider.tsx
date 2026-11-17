import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { alVolverLaConexion } from '../lib/conexion'
import { supabase } from '../lib/supabase'
import { borrarSesionGuardada, obtenerPerfil, type Perfil } from '../lib/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

interface PerfilCargado {
  userId: string
  perfil: Perfil | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = todavía no sabemos si hay sesión (primer evento de Supabase pendiente)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfilCargado, setPerfilCargado] = useState<PerfilCargado | null>(null)
  const [intentoPerfil, setIntentoPerfil] = useState(0)

  useEffect(() => {
    // onAuthStateChange emite INITIAL_SESSION al suscribirse, así que cubre la sesión persistida.
    // Solo se actualiza estado: llamar a Supabase dentro de este callback puede trabarlo.
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    const id = userId
    let cancelado = false

    obtenerPerfil(id).then(
      (perfil) => {
        if (cancelado) return
        if (!perfil || !perfil.activo) {
          // Sesión válida en Auth pero sin perfil activo: no se le permite operar
          void supabase.auth.signOut()
          return
        }
        setPerfilCargado({ userId: id, perfil })
      },
      () => {
        // Sin conexión o falla del servidor: <RequireAuth> muestra el error
        if (!cancelado) setPerfilCargado({ userId: id, perfil: null })
      },
    )
    return () => {
      cancelado = true
    }
  }, [userId, intentoPerfil])

  // No se pudo cargar el perfil porque no había conexión: se reintenta solo cuando vuelve
  const perfilFallido = perfilCargado !== null && perfilCargado.userId === userId && perfilCargado.perfil === null
  useEffect(() => {
    if (!perfilFallido) return
    return alVolverLaConexion(() => setIntentoPerfil((n) => n + 1))
  }, [perfilFallido])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    // Sin red, signOut() no puede avisarle al servidor: igual se asegura de no dejarla guardada
    if (error) borrarSesionGuardada()
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
