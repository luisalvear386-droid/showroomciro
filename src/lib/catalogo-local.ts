import { guardarCatalogo, type VentaPendiente } from './db-local'
import { obtenerProductos, type ProductoListado } from './productos'
import { supabase } from './supabase'

/** Número del último refresco empezado: uno más viejo que termine después no pisa al nuevo. */
let ultimoRefresco = 0

/**
 * Baja el catálogo del POS (solo productos activos: los dados de baja no se ofrecen en el
 * mostrador) y lo guarda en la base local. Si no se puede guardar (IndexedDB no disponible),
 * igual devuelve los productos para usarlos en memoria.
 *
 * Sin sesión válida falla sin consultar: la consulta saldría con la anon key, el RLS
 * devolvería 0 productos sin error y se pisaría el catálogo guardado con uno vacío.
 */
export async function refrescarCatalogo(): Promise<ProductoListado[]> {
  const numero = ++ultimoRefresco
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sin sesión válida: no se refresca el catálogo')
  const productos = await obtenerProductos({ soloActivos: true })
  if (numero === ultimoRefresco) {
    await guardarCatalogo(productos).catch((error: unknown) => {
      console.warn('Base local: no se pudo guardar el catálogo.', error)
    })
  }
  return productos
}

export function ordenarCatalogo(productos: ProductoListado[]): ProductoListado[] {
  return [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Stock que ve el mostrador: el del último catálogo bajado, menos lo vendido que todavía
 * está en la cola (pendiente o con error: en los dos casos la prenda ya salió del local).
 *
 * Se calcula en vez de restarlo sobre el catálogo guardado: cuando la venta se sincroniza
 * sale de la cola y el próximo catálogo ya trae el stock descontado, sin restar dos veces.
 */
export function aplicarPendientes(productos: ProductoListado[], pendientes: VentaPendiente[]): ProductoListado[] {
  if (pendientes.length === 0) return productos

  const vendido = new Map<string, number>()
  for (const venta of pendientes) {
    for (const item of venta.items) vendido.set(item.variante_id, (vendido.get(item.variante_id) ?? 0) + item.cantidad)
  }

  return productos.map((p) => {
    if (!p.variantes.some((v) => vendido.has(v.id))) return p
    const variantes = p.variantes.map((v) =>
      vendido.has(v.id) ? { ...v, stock: Math.max(v.stock - (vendido.get(v.id) ?? 0), 0) } : v,
    )
    return {
      ...p,
      variantes,
      stock_total: variantes.reduce((total, v) => total + v.stock, 0),
      stock_bajo: variantes.some((v) => v.stock <= v.stock_minimo),
    }
  })
}
