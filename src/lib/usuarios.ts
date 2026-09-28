import { normalizarNombreUsuario, type Perfil } from './auth'
import { supabase } from './supabase'

/** Todos los perfiles (el RLS solo se los muestra completos al Dueño/a): primero los Dueño/a, después por nombre. */
export async function obtenerUsuarios(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre_usuario, rol, activo')
    .order('rol', { ascending: true })
    .order('nombre_usuario', { ascending: true })

  if (error) throw error
  return (data ?? []) as Perfil[]
}

export type ResultadoUsuario = { ok: true } | { ok: false; error: string }

/**
 * Alta de Vendedor vía la RPC `crear_vendedor()` (0011): crea el usuario de Supabase Auth
 * con el email técnico y su perfil en una sola transacción.
 */
export async function crearVendedor(nombreUsuario: string, contrasena: string): Promise<ResultadoUsuario> {
  const { error } = await supabase.rpc('crear_vendedor', {
    p_nombre_usuario: normalizarNombreUsuario(nombreUsuario),
    p_contrasena: contrasena,
  })
  if (!error) return { ok: true }

  // 22023 / 23505: el mensaje de la función está pensado para mostrarse tal cual
  if (error.code === '22023' || error.code === '23505') return { ok: false, error: error.message }
  if (error.code === '42501') return { ok: false, error: 'No tenés permiso para crear usuarios.' }
  return { ok: false, error: 'No se pudo crear el vendedor. Revisá la conexión e intentá de nuevo.' }
}

/** Desactivar / reactivar: UPDATE de `perfiles.activo`, permitido solo al Dueño/a por RLS. */
export async function cambiarActivoUsuario(id: string, activo: boolean): Promise<ResultadoUsuario> {
  const { data, error } = await supabase.from('perfiles').update({ activo }).eq('id', id).select('id')
  // Sin error pero sin filas: el RLS no dejó actualizar
  if (!error && data && data.length > 0) return { ok: true }
  return {
    ok: false,
    error: `No se pudo ${activo ? 'reactivar' : 'desactivar'} el usuario. Revisá la conexión e intentá de nuevo.`,
  }
}

/** "4 usuarios · 3 activos" — resumen de Gestión de Usuarios y de su acceso en Configuración (mobile). */
export function resumirUsuarios(usuarios: Perfil[]): string {
  const activos = usuarios.filter((u) => u.activo).length
  return `${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'} · ${activos} ${activos === 1 ? 'activo' : 'activos'}`
}
