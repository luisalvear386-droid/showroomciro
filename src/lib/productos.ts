import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Categoria {
  id: string
  nombre: string
}

export interface Variante {
  id: string
  talle: string
  color: string
  sku: string
  stock: number
  stock_minimo: number
}

export interface ProductoListado {
  id: string
  codigo: number
  nombre: string
  precio: number
  foto_url: string | null
  activo: boolean
  categoria: string | null
  variantes: Variante[]
  stock_total: number
  /** true si alguna variante está en o por debajo de su stock mínimo. */
  stock_bajo: boolean
}

export interface ProductoDetalle {
  id: string
  codigo: number
  nombre: string
  descripcion: string | null
  categoria_id: string | null
  precio: number
  foto_url: string | null
  activo: boolean
  variantes: Variante[]
}

export interface DatosProducto {
  nombre: string
  descripcion: string | null
  categoria_id: string
  precio: number
}

export interface VarianteNueva {
  talle: string
  color: string
  stock: number
  stock_minimo: number
}

export type TipoAjuste = 'suma' | 'resta'

// ---------------------------------------------------------------------------
// Fotos (bucket `fotos-productos`, ver supabase/migrations/0005_storage.sql)
// ---------------------------------------------------------------------------

const BUCKET_FOTOS = 'fotos-productos'
/** Mismo límite y tipos que tiene configurados el bucket. */
export const FOTO_TAMANIO_MAXIMO = 5 * 1024 * 1024
const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export const FOTO_TIPOS_ACEPTADOS = Object.keys(EXTENSION_POR_TIPO).join(',')

/** Devuelve el motivo si el archivo no se puede subir, o null si está bien. */
export function validarFoto(archivo: File): string | null {
  if (!(archivo.type in EXTENSION_POR_TIPO)) return 'La foto tiene que ser JPG, PNG o WebP.'
  if (archivo.size > FOTO_TAMANIO_MAXIMO) return 'La foto no puede pesar más de 5 MB.'
  return null
}

/**
 * Sube la foto en la ruta fija `<producto_id>.<ext>` (pisa la anterior) y guarda la URL
 * pública en `productos.foto_url` con `?v=<timestamp>`, para que el navegador no siga
 * mostrando la versión cacheada.
 */
async function subirFoto(productoId: string, archivo: File): Promise<void> {
  const ruta = `${productoId}.${EXTENSION_POR_TIPO[archivo.type]}`
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type })
  if (error) throw error

  const { publicUrl } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data
  const { error: errorUpdate } = await supabase
    .from('productos')
    .update({ foto_url: `${publicUrl}?v=${Date.now()}` })
    .eq('id', productoId)
  if (errorUpdate) throw errorUpdate
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

const COLUMNAS_VARIANTE = 'id, talle, color, sku, stock, stock_minimo'

function ordenarVariantes(variantes: Variante[]): Variante[] {
  return [...variantes].sort(
    (a, b) => a.color.localeCompare(b.color, 'es') || a.talle.localeCompare(b.talle, 'es', { numeric: true }),
  )
}

/** "SC-001": prefijo que comparten los SKU de todas las variantes del producto. */
export function codigoProducto(codigo: number): string {
  return `SC-${String(codigo).padStart(3, '0')}`
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('id, nombre').order('nombre')
  if (error) throw error
  return data
}

interface FilaListado {
  id: string
  codigo: number
  nombre: string
  precio: number
  foto_url: string | null
  activo: boolean
  categorias: { nombre: string } | null
  variantes: Variante[]
}

export async function obtenerProductos(): Promise<ProductoListado[]> {
  const { data, error } = await supabase
    .from('productos')
    .select(`id, codigo, nombre, precio, foto_url, activo, categorias(nombre), variantes(${COLUMNAS_VARIANTE})`)
    .order('nombre')
  if (error) throw error

  return (data as unknown as FilaListado[]).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    precio: Number(p.precio),
    foto_url: p.foto_url,
    activo: p.activo,
    categoria: p.categorias?.nombre ?? null,
    variantes: p.variantes,
    stock_total: p.variantes.reduce((total, v) => total + v.stock, 0),
    stock_bajo: p.variantes.some((v) => v.stock <= v.stock_minimo),
  }))
}

/**
 * Costos por producto. Solo tiene sentido llamarla como Dueño/a: para el Vendedor el RLS
 * de `productos_costos` devuelve 0 filas, pero ni siquiera se consulta.
 */
export async function obtenerCostos(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('productos_costos').select('producto_id, costo')
  if (error) throw error
  return new Map(data.map((c) => [c.producto_id as string, Number(c.costo)]))
}

export async function obtenerCosto(productoId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('productos_costos')
    .select('costo')
    .eq('producto_id', productoId)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.costo) : null
}

export async function obtenerProducto(id: string): Promise<ProductoDetalle | null> {
  const { data, error } = await supabase
    .from('productos')
    .select(`id, codigo, nombre, descripcion, categoria_id, precio, foto_url, activo, variantes(${COLUMNAS_VARIANTE})`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const producto = data as unknown as ProductoDetalle
  return { ...producto, precio: Number(producto.precio), variantes: ordenarVariantes(producto.variantes) }
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/**
 * `costo`: `undefined` = no tocar (Vendedor, que ni lo ve); `null` = sin costo cargado;
 * número = guardar ese costo.
 */
async function guardarCosto(productoId: string, costo: number | null | undefined): Promise<void> {
  if (costo === undefined) return
  const { error } =
    costo === null
      ? await supabase.from('productos_costos').delete().eq('producto_id', productoId)
      : await supabase.from('productos_costos').upsert({ producto_id: productoId, costo })
  if (error) throw error
}

async function insertarVariantes(productoId: string, variantes: VarianteNueva[]): Promise<void> {
  if (variantes.length === 0) return
  // Sin `sku`: lo genera el trigger `trg_variantes_generar_sku` (0003).
  const { error } = await supabase
    .from('variantes')
    .insert(variantes.map((v) => ({ ...v, producto_id: productoId })))
  if (error) throw error
}

export interface AltaProducto {
  datos: DatosProducto
  costo: number | null | undefined
  foto: File | null
  variantes: VarianteNueva[]
}

/**
 * Crea el producto y sus variantes. No es una transacción: si algo falla después de
 * insertar el producto, lanza `ErrorAltaParcial` con el id para poder seguir desde la edición.
 */
export async function crearProducto({ datos, costo, foto, variantes }: AltaProducto): Promise<string> {
  const { data, error } = await supabase.from('productos').insert(datos).select('id').single()
  if (error) throw error

  const id = data.id as string
  try {
    await guardarCosto(id, costo)
    await insertarVariantes(id, variantes)
    if (foto) await subirFoto(id, foto)
  } catch (causa) {
    throw new ErrorAltaParcial(id, causa)
  }
  return id
}

export class ErrorAltaParcial extends Error {
  readonly productoId: string
  readonly causa: unknown

  constructor(productoId: string, causa: unknown) {
    super('El producto se creó, pero no se pudo guardar todo.')
    this.productoId = productoId
    this.causa = causa
  }
}

export interface EdicionProducto extends AltaProducto {
  id: string
  /** Solo las variantes ya guardadas cuyo stock mínimo cambió. */
  stockMinimos: { id: string; stock_minimo: number }[]
}

export async function actualizarProducto({
  id,
  datos,
  costo,
  foto,
  variantes,
  stockMinimos,
}: EdicionProducto): Promise<void> {
  const { error } = await supabase.from('productos').update(datos).eq('id', id)
  if (error) throw error

  await guardarCosto(id, costo)
  for (const v of stockMinimos) {
    const { error: errorVariante } = await supabase
      .from('variantes')
      .update({ stock_minimo: v.stock_minimo })
      .eq('id', v.id)
    if (errorVariante) throw errorVariante
  }
  await insertarVariantes(id, variantes)
  if (foto) await subirFoto(id, foto)
}

/** Baja / reactivación: los productos no se borran (tienen ventas y ajustes asociados). */
export async function cambiarActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('productos').update({ activo }).eq('id', id)
  if (error) throw error
}

/**
 * Registra el ajuste. El trigger `trg_ajustes_stock_aplicar` (0007) actualiza
 * `variantes.stock` en la misma transacción; `usuario_id` lo completa la base.
 * Devuelve el stock resultante.
 */
export async function ajustarStock(
  varianteId: string,
  tipo: TipoAjuste,
  cantidad: number,
  motivo: string,
): Promise<number> {
  const { error } = await supabase.from('ajustes_stock').insert({ variante_id: varianteId, tipo, cantidad, motivo })
  if (error) throw error

  const { data, error: errorLectura } = await supabase
    .from('variantes')
    .select('stock')
    .eq('id', varianteId)
    .single()
  if (errorLectura) throw errorLectura
  return data.stock as number
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

function esErrorPostgrest(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/** Traduce un error de Supabase a un mensaje para mostrar. */
export function mensajeDeError(error: unknown): string {
  const causa = error instanceof ErrorAltaParcial ? error.causa : error
  if (esErrorPostgrest(causa)) {
    if (causa.code === '23505') return 'Ya existe una variante con ese talle y color.'
    if (causa.code === '23514') return 'El stock no puede quedar negativo.'
    if (causa.code === '42501') return 'No tenés permiso para hacer esta operación.'
  }
  if (causa instanceof Error && /exceeded the maximum allowed size|Payload too large/i.test(causa.message)) {
    return 'La foto no puede pesar más de 5 MB.'
  }
  return 'No se pudo guardar. Revisá la conexión e intentá de nuevo.'
}
