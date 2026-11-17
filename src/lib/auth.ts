import { CLAVE_SESION, supabase } from './supabase'

export type Rol = 'dueño' | 'vendedor'

export interface Perfil {
  id: string
  nombre_usuario: string
  rol: Rol
  activo: boolean
}

/** Dominio técnico con el que se mapea el nombre de usuario a un email de Supabase Auth. */
const DOMINIO_EMAIL_TECNICO = 'showroomciro.internal'

/** Mensaje único para cualquier fallo de credenciales: no revela si falló el usuario o la contraseña. */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.'
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá la conexión e intentá de nuevo.'

const NOMBRE_USUARIO_VALIDO = /^[a-z0-9._-]+$/

export function normalizarNombreUsuario(nombreUsuario: string): string {
  return nombreUsuario.trim().toLowerCase()
}

export function emailTecnico(nombreUsuario: string): string {
  return `${normalizarNombreUsuario(nombreUsuario)}@${DOMINIO_EMAIL_TECNICO}`
}

export async function obtenerPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre_usuario, rol, activo')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Perfil | null
}

/**
 * true si supabase-js dejó una sesión guardada, aunque no la haya podido restaurar.
 *
 * Con el access token vencido y sin red, supabase-js no puede renovarlo: reintenta ~30 s,
 * avisa `INITIAL_SESSION` con null y deja la sesión en localStorage (solo la borra si el
 * servidor rechaza el refresh token). En ese caso la app muestra "Sin conexión" en vez de
 * mandar al login: cuando vuelva internet, la sesión se renueva sola.
 */
export function haySesionGuardada(): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION)
    if (!crudo) return false
    const sesion = JSON.parse(crudo) as { refresh_token?: unknown }
    return typeof sesion.refresh_token === 'string'
  } catch {
    return false
  }
}

/**
 * Borra la sesión guardada a mano. Hace falta al salir sin red con el token vencido:
 * ahí `signOut()` devuelve el error de red antes de borrarla, y el próximo arranque la
 * volvería a encontrar. El refresh token sigue vigente en el servidor hasta que venza.
 */
export function borrarSesionGuardada(): void {
  try {
    localStorage.removeItem(CLAVE_SESION)
    localStorage.removeItem(`${CLAVE_SESION}-user`)
  } catch {
    // Sin acceso a localStorage tampoco hay sesión guardada que borrar
  }
}

export type ResultadoLogin ={ ok: true } | { ok: false; error: string }

/**
 * Login por usuario/contraseña. El usuario nunca ve el email técnico.
 * Cualquier problema de credenciales (usuario inexistente, contraseña incorrecta,
 * perfil faltante o desactivado) devuelve el mismo mensaje genérico.
 */
export async function login(nombreUsuario: string, contrasena: string): Promise<ResultadoLogin> {
  const usuario = normalizarNombreUsuario(nombreUsuario)
  if (!usuario || !contrasena || !NOMBRE_USUARIO_VALIDO.test(usuario)) {
    return { ok: false, error: MENSAJE_CREDENCIALES_INVALIDAS }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailTecnico(usuario),
      password: contrasena,
    })

    if (error) {
      // 4xx = credenciales inválidas; 0/5xx = fallo de red o del servidor
      const esErrorDeCredenciales = !!error.status && error.status >= 400 && error.status < 500
      return {
        ok: false,
        error: esErrorDeCredenciales ? MENSAJE_CREDENCIALES_INVALIDAS : MENSAJE_SIN_CONEXION,
      }
    }

    const perfil = await obtenerPerfil(data.user.id)
    if (!perfil || !perfil.activo) {
      await supabase.auth.signOut()
      return { ok: false, error: MENSAJE_CREDENCIALES_INVALIDAS }
    }

    return { ok: true }
  } catch {
    await supabase.auth.signOut().catch(() => undefined)
    return { ok: false, error: MENSAJE_SIN_CONEXION }
  }
}
