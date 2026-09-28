import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { borrarSesionGuardada, leerSesionGuardada, obtenerPerfil, type Perfil } from '../lib/auth'
import { borrarPerfilGuardado, guardarPerfil, leerPerfilGuardado } from '../lib/db-local'
import { AuthContext, type AuthContextValue } from './auth-context'

/**
 * Cuánto se espera el INITIAL_SESSION de Supabase antes de entrar en modo "sesión offline"
 * cuando el token guardado está vencido: sin red, supabase-js reintenta renovarlo ~30 s
 * antes de avisar, y el mostrador quedaría todo ese tiempo en la pantalla de carga.
 */
const ESPERA_SESION_MS = 3000

interface PerfilCargado {
  userId: string
  perfil: Perfil | null
  /** true mientras el perfil sea el guardado en la base local, sin confirmar con el servidor. */
  deCache: boolean
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = todavía no sabemos si hay sesión (primer evento de Supabase pendiente)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  /**
   * Modo "sesión offline": arrancó sin red con el token vencido. Supabase no pudo restaurar
   * la sesión pero la dejó guardada; se sigue operando con su usuario hasta que vuelva la
   * red y se renueve (TOKEN_REFRESHED), o hasta que el servidor la rechace (SIGNED_OUT).
   */
  const [usuarioOffline, setUsuarioOffline] = useState<User | null>(null)
  const [perfilCargado, setPerfilCargado] = useState<PerfilCargado | null>(null)
  const [intentoPerfil, setIntentoPerfil] = useState(0)

  useEffect(() => {
    let inicialRecibido = false

    // onAuthStateChange emite INITIAL_SESSION al suscribirse, así que cubre la sesión persistida.
    // Solo se actualiza estado: llamar a Supabase dentro de este callback puede trabarlo.
    const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      if (evento === 'INITIAL_SESSION') inicialRecibido = true
      if (nuevaSesion) {
        setUsuarioOffline(null)
      } else if (evento === 'INITIAL_SESSION') {
        setUsuarioOffline(leerSesionGuardada()?.usuario ?? null)
      } else if (evento === 'SIGNED_OUT') {
        setUsuarioOffline(null)
      }
      setSession(nuevaSesion)
    })

    // Token vencido y Supabase todavía intentando renovarlo: se entra ya en modo offline.
    // Si la renovación llega después, TOKEN_REFRESHED/INITIAL_SESSION lo saca de ese modo.
    const espera = window.setTimeout(() => {
      if (inicialRecibido) return
      const guardada = leerSesionGuardada()
      if (!guardada?.vencida) return
      setUsuarioOffline(guardada.usuario)
      setSession(null)
    }, ESPERA_SESION_MS)

    return () => {
      window.clearTimeout(espera)
      data.subscription.unsubscribe()
    }
  }, [])

  const sesionOffline = !session && usuarioOffline !== null

  // Al volver la red se pide la sesión en vez de esperar al refresco automático (cada 30 s):
  // getSession() renueva el token y emite TOKEN_REFRESHED. Si hubo una falla hace menos de
  // 60 s, supabase-js la devuelve cacheada y la renovación queda para el próximo intento.
  useEffect(() => {
    if (!sesionOffline) return
    function alReconectar() {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setUsuarioOffline(null)
          setSession(data.session)
        }
      })
    }
    window.addEventListener('online', alReconectar)
    return () => window.removeEventListener('online', alReconectar)
  }, [sesionOffline])

  const usuario = session?.user ?? usuarioOffline
  const userId = usuario?.id ?? null

  // El perfil guardado se muestra enseguida y se confirma con el servidor en segundo plano:
  // sin red, la consulta tarda ~7 s en fallar (postgrest-js reintenta los GET).
  useEffect(() => {
    if (!userId) return
    const id = userId
    let cancelado = false

    async function cargar() {
      const guardado = await leerPerfilGuardado(id)
      if (cancelado) return
      if (guardado) {
        // No pisa un perfil ya confirmado (esto se vuelve a correr al reconectar)
        setPerfilCargado((previo) =>
          previo?.userId === id && !previo.deCache ? previo : { userId: id, perfil: guardado, deCache: true },
        )
      }

      // Sin sesión válida no se consulta: la consulta iría con la anon key y el RLS devolvería
      // "sin perfil", que se confundiría con un usuario desactivado.
      if (sesionOffline) {
        if (!guardado) setPerfilCargado({ userId: id, perfil: null, deCache: false })
        return
      }

      try {
        const perfil = await obtenerPerfil(id)
        if (cancelado) return
        if (!perfil || !perfil.activo) {
          // Sesión válida en Auth pero sin perfil activo: no se le permite operar
          void borrarPerfilGuardado(id)
          void supabase.auth.signOut()
          return
        }
        void guardarPerfil(perfil)
        setPerfilCargado({ userId: id, perfil, deCache: false })
      } catch {
        // Sin conexión (o falla del servidor): queda el guardado, si había
        if (!cancelado && !guardado) setPerfilCargado({ userId: id, perfil: null, deCache: false })
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [userId, sesionOffline, intentoPerfil])

  // Perfil sin confirmar con la sesión vigente: se vuelve a consultar al reconectar (entre
  // otras cosas, para enterarse si mientras tanto desactivaron al usuario).
  const perfilSinConfirmar = perfilCargado?.deCache === true && !sesionOffline
  useEffect(() => {
    if (!perfilSinConfirmar) return
    const alReconectar = () => setIntentoPerfil((n) => n + 1)
    window.addEventListener('online', alReconectar)
    return () => window.removeEventListener('online', alReconectar)
  }, [perfilSinConfirmar])

  const logout = useCallback(async () => {
    // En sesión offline signOut() no sirve: espera a que supabase-js termine de reintentar
    // la renovación (~30 s) y después ni siquiera borra la sesión guardada. Se borra a mano
    // para que el próximo arranque no la retome; si justo vuelve la red, supabase-js
    // descarta la renovación en curso porque la sesión guardada cambió mientras tanto.
    if (sesionOffline) {
      borrarSesionGuardada()
      setUsuarioOffline(null)
      return
    }
    const { error } = await supabase.auth.signOut()
    // Sin red, signOut() no puede avisarle al servidor: igual se asegura de no dejarla guardada
    if (error) borrarSesionGuardada()
  }, [sesionOffline])

  const value = useMemo<AuthContextValue>(() => {
    const perfil = userId && perfilCargado?.userId === userId ? perfilCargado.perfil : null
    const cargando = session === undefined || (userId !== null && perfilCargado?.userId !== userId)
    return {
      usuario,
      perfil,
      rol: perfil?.rol ?? null,
      cargando,
      sesionOffline,
      logout,
    }
  }, [session, usuario, userId, perfilCargado, sesionOffline, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
