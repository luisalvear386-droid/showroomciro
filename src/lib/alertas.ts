import { supabase } from './supabase'

export interface VarianteStockBajo {
  id: string
  talle: string
  color: string
  stock: number
  stock_minimo: number
  producto_nombre: string
}

export type EstadoCuentaEnAlerta = 'por_vencer' | 'vencido'

export interface CuentaEnAlerta {
  id: string
  cliente_nombre: string
  saldo: number
  fecha_limite: string
  estado: EstadoCuentaEnAlerta
}

const ESTADOS_EN_ALERTA: EstadoCuentaEnAlerta[] = ['vencido', 'por_vencer']

interface FilaVariante {
  id: string
  talle: string
  color: string
  stock: number
  stock_minimo: number
  productos: { nombre: string } | null
}

/**
 * Variantes de productos activos con `stock <= stock_minimo`, de menor a mayor stock.
 *
 * PostgREST no permite comparar dos columnas en un filtro, así que el umbral se aplica acá.
 * Se traen solo las columnas mínimas de las variantes de productos activos, que para un
 * único local es un volumen chico.
 */
export async function obtenerStockBajo(): Promise<VarianteStockBajo[]> {
  const { data, error } = await supabase
    .from('variantes')
    .select('id, talle, color, stock, stock_minimo, productos!inner(nombre)')
    .eq('productos.activo', true)
    .order('stock', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as FilaVariante[])
    .filter((v) => v.stock <= v.stock_minimo)
    .map((v) => ({
      id: v.id,
      talle: v.talle,
      color: v.color,
      stock: v.stock,
      stock_minimo: v.stock_minimo,
      producto_nombre: v.productos?.nombre ?? '',
    }))
}

/** Cuentas vencidas o por vencer (según `cuentas_vista`), las más atrasadas primero. */
export async function obtenerCuentasEnAlerta(): Promise<CuentaEnAlerta[]> {
  const { data, error } = await supabase
    .from('cuentas_vista')
    .select('id, cliente_nombre, saldo, fecha_limite, estado')
    .in('estado', ESTADOS_EN_ALERTA)
    .order('fecha_limite', { ascending: true })

  if (error) throw error

  return ((data ?? []) as CuentaEnAlerta[]).map((c) => ({ ...c, saldo: Number(c.saldo) }))
}

/** Solo la cantidad, para el badge del ítem "Cuentas" del menú. */
export async function contarCuentasEnAlerta(): Promise<number> {
  const { count, error } = await supabase
    .from('cuentas_vista')
    .select('id', { count: 'exact', head: true })
    .in('estado', ESTADOS_EN_ALERTA)

  if (error) throw error
  return count ?? 0
}
