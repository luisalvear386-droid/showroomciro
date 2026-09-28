import type { PostgrestError } from '@supabase/supabase-js'
import { diasHasta } from './formato'
import { supabase } from './supabase'

export type EstadoCuenta = 'al_dia' | 'por_vencer' | 'vencido' | 'pagado'

/** Fila de `cuentas_vista`: saldo y estado calculados al vuelo por la base. */
export interface Cuenta {
  id: string
  cliente_nombre: string
  cliente_telefono: string | null
  monto_total: number
  fecha_limite: string
  created_at: string
  total_pagado: number
  saldo: number
  estado: EstadoCuenta
}

export interface PagoCuenta {
  id: string
  monto: number
  fecha: string
}

export interface CuentaDetalle {
  cuenta: Cuenta
  /** Del más viejo al más nuevo. */
  pagos: PagoCuenta[]
}

export interface CuentaNueva {
  cliente_nombre: string
  cliente_telefono: string | null
  monto_total: number
  fecha_limite: string
}

export const ETIQUETA_ESTADO: Record<EstadoCuenta, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  pagado: 'Pagado',
}

/** Días de aviso de `cuentas_vista` (0003, `dias_aviso_por_vencer`). Solo para textos de ayuda. */
export const DIAS_AVISO_POR_VENCER = 3

const COLUMNAS_VISTA =
  'id, cliente_nombre, cliente_telefono, monto_total, fecha_limite, created_at, total_pagado, saldo, estado'

// numeric llega como number o string según el tamaño: se normaliza
function normalizarCuenta(fila: Cuenta): Cuenta {
  return {
    ...fila,
    monto_total: Number(fila.monto_total),
    total_pagado: Number(fila.total_pagado),
    saldo: Number(fila.saldo),
  }
}

/** Todas las cuentas (activas y pagadas), de la que vence antes a la que vence después. */
export async function obtenerCuentas(): Promise<Cuenta[]> {
  const { data, error } = await supabase
    .from('cuentas_vista')
    .select(COLUMNAS_VISTA)
    .order('fecha_limite', { ascending: true })
    .order('cliente_nombre', { ascending: true })

  if (error) throw error
  return ((data ?? []) as Cuenta[]).map(normalizarCuenta)
}

/** Una cuenta con su historial de pagos, o null si no existe. */
export async function obtenerCuentaDetalle(id: string): Promise<CuentaDetalle | null> {
  const [cuenta, pagos] = await Promise.all([
    supabase.from('cuentas_vista').select(COLUMNAS_VISTA).eq('id', id).maybeSingle(),
    supabase.from('cuenta_pagos').select('id, monto, fecha').eq('cuenta_id', id).order('fecha', { ascending: true }),
  ])

  if (cuenta.error) throw cuenta.error
  if (pagos.error) throw pagos.error
  if (!cuenta.data) return null

  return {
    cuenta: normalizarCuenta(cuenta.data as Cuenta),
    pagos: ((pagos.data ?? []) as PagoCuenta[]).map((p) => ({ ...p, monto: Number(p.monto) })),
  }
}

/** Alta simple: insert directo en `cuentas` (policy `cuentas_insert`). */
export async function crearCuenta(datos: CuentaNueva): Promise<void> {
  const { error } = await supabase.from('cuentas').insert(datos)
  if (error) throw error
}

/**
 * Registra un cobro vía `registrar_pago()` (0009): valida contra el saldo pendiente con la
 * cuenta bloqueada, así dos cobros simultáneos nunca pasan el saldo. Devuelve la cuenta
 * ya actualizada.
 */
export async function registrarPago(cuentaId: string, monto: number): Promise<Cuenta> {
  const { data, error } = await supabase.rpc('registrar_pago', { p_cuenta_id: cuentaId, p_monto: monto })
  if (error) throw error
  return normalizarCuenta(data as Cuenta)
}

function esErrorPostgrest(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/** Errores de `registrar_pago()` cuyo mensaje ya está escrito para mostrarse tal cual. */
const CODIGOS_CON_MENSAJE = new Set(['23514', '22023', 'P0002'])

/** Traduce un error al cobrar a un mensaje para la pantalla de cobro. */
export function mensajeErrorPago(error: unknown): string {
  if (esErrorPostgrest(error)) {
    if (CODIGOS_CON_MENSAJE.has(error.code)) return error.message
    if (error.code === '42501') return 'No tenés permiso para registrar cobros.'
  }
  return 'No se pudo registrar el cobro. Revisá la conexión e intentá de nuevo.'
}

/** Traduce un error al guardar una cuenta nueva. */
export function mensajeErrorAlta(error: unknown): string {
  if (esErrorPostgrest(error) && error.code === '42501') return 'No tenés permiso para abrir cuentas.'
  return 'No se pudo guardar la cuenta. Revisá la conexión e intentá de nuevo.'
}

/** "Vencido hace 4 días", "Vence hoy", "Vence en 3 días"… */
export function describirVencimiento(fechaLimite: string): string {
  const dias = diasHasta(fechaLimite)
  if (dias < -1) return `Vencido hace ${-dias} días`
  if (dias === -1) return 'Venció ayer'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

/** "hace 4 días", "hoy", "mañana", "en 12 días" (columna de la agenda). */
export function vencimientoRelativo(fechaLimite: string): string {
  const dias = diasHasta(fechaLimite)
  if (dias < -1) return `hace ${-dias} días`
  if (dias === -1) return 'ayer'
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}

/** "LF" para "Lucía Fernández". */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
