import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTieneRol } from '../auth/use-auth'
import { FotoProducto } from '../components/producto-visual'
import { useConsulta } from '../hooks/use-consulta'
import { formatearMoneda } from '../lib/formato'
import {
  cambiarActivo,
  codigoProducto,
  mensajeDeError,
  obtenerCategorias,
  obtenerCostos,
  obtenerProductos,
  type ProductoListado,
} from '../lib/productos'
import './productos-page.css'

const TODAS = ''
const ESTADOS = ['Todos', 'Activos', 'Inactivos'] as const
type FiltroEstado = (typeof ESTADOS)[number]
const POR_PAGINA = 20

/** Para el Vendedor no se consulta `productos_costos` (igual el RLS le devolvería 0 filas). */
async function sinCostos(): Promise<Map<string, number>> {
  return new Map()
}

function claseStock(p: ProductoListado): string {
  if (p.stock_total === 0) return 'stock--agotado'
  if (p.stock_bajo) return 'stock--bajo'
  return ''
}

/** Productos — Listado, según prototipos/Productos Listado.dc.html */
export function ProductosPage() {
  const navigate = useNavigate()
  const esDueno = useTieneRol('dueño')
  const productos = useConsulta(obtenerProductos)
  const categorias = useConsulta(obtenerCategorias)
  const costos = useConsulta(esDueno ? obtenerCostos : sinCostos)

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState(TODAS)
  const [estado, setEstado] = useState<FiltroEstado>('Todos')
  const [pagina, setPagina] = useState(0)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lista = useMemo(() => productos.datos ?? [], [productos.datos])
  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return lista.filter(
      (p) =>
        (categoria === TODAS || p.categoria === categoria) &&
        (estado === 'Todos' || (estado === 'Activos') === p.activo) &&
        (!termino ||
          p.nombre.toLowerCase().includes(termino) ||
          codigoProducto(p.codigo).toLowerCase().includes(termino) ||
          p.variantes.some((v) => v.sku.toLowerCase().includes(termino))),
    )
  }, [lista, busqueda, categoria, estado])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const visibles = filtrados.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA)
  const activos = lista.filter((p) => p.activo).length

  function filtrar(accion: () => void) {
    accion()
    setPagina(0)
  }

  async function alternarActivo(p: ProductoListado) {
    setMenuAbierto(null)
    setCambiando(p.id)
    setError(null)
    try {
      await cambiarActivo(p.id, !p.activo)
      productos.recargar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCambiando(null)
    }
  }

  let mensajeVacio = 'No hay productos que coincidan con el filtro.'
  if (productos.error) mensajeVacio = 'No se pudieron cargar los productos. Revisá la conexión.'
  else if (productos.datos === undefined) mensajeVacio = 'Cargando…'
  else if (lista.length === 0) mensajeVacio = 'Todavía no hay productos cargados.'

  return (
    <div className="productos">
      <div className="productos__encabezado">
        <div className="productos__titulos">
          <h1 className="productos__titulo">Productos</h1>
          <p className="productos__resumen">
            {productos.datos
              ? `${lista.length} ${lista.length === 1 ? 'producto cargado' : 'productos cargados'} · ${activos} ${activos === 1 ? 'activo' : 'activos'}`
              : ' '}
          </p>
        </div>
        <button type="button" className="boton-primario" onClick={() => navigate('/productos/nuevo')}>
          + Agregar Producto
        </button>
      </div>

      <div className="productos__filtros">
        <label className="productos__buscador">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B87A56" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => filtrar(() => setBusqueda(e.target.value))}
            placeholder="Buscar por nombre o SKU…"
            aria-label="Buscar por nombre o SKU"
          />
        </label>
        <select
          className="productos__select"
          value={categoria}
          onChange={(e) => filtrar(() => setCategoria(e.target.value))}
          aria-label="Categoría"
        >
          <option value={TODAS}>Todas las categorías</option>
          {(categorias.datos ?? []).map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
        <div className="productos__estados" role="group" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              className="productos__pill"
              aria-pressed={estado === e}
              onClick={() => filtrar(() => setEstado(e))}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mensaje-error" role="alert">
          {error}
        </div>
      )}

      <div className="productos__tabla-card">
        <div className="productos__tabla-scroll">
          <table className="productos__tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Precio</th>
                {esDueno && <th className="num">Costo</th>}
                <th className="num">Stock</th>
                <th>Estado</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const costo = costos.datos?.get(p.id)
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="producto-celda">
                        <FotoProducto url={p.foto_url} nombre={p.nombre} className="producto-celda__foto" />
                        <span className="producto-celda__textos">
                          <span className="producto-celda__nombre">{p.nombre}</span>
                          <span className="sku">{codigoProducto(p.codigo)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="productos__categoria">{p.categoria ?? 'Sin categoría'}</td>
                    <td className="num productos__precio">{formatearMoneda(p.precio)}</td>
                    {esDueno && (
                      <td className="num productos__costo">{costo === undefined ? '—' : formatearMoneda(costo)}</td>
                    )}
                    <td className="num">
                      <span className="productos__stock">
                        <span className={`productos__stock-total ${claseStock(p)}`}>{p.stock_total} u.</span>
                        <span className="productos__stock-variantes">
                          {p.variantes.length} {p.variantes.length === 1 ? 'variante' : 'variantes'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={p.activo ? 'estado estado--activo' : 'estado'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <span className="productos__acciones">
                        <button
                          type="button"
                          className="productos__editar"
                          onClick={() => navigate(`/productos/${p.id}/editar`)}
                        >
                          Editar
                        </button>
                        <span className="productos__mas-contenedor">
                          <button
                            type="button"
                            className="productos__mas"
                            title={p.activo ? 'Dar de baja' : 'Reactivar'}
                            aria-label={`Más acciones para ${p.nombre}`}
                            aria-expanded={menuAbierto === p.id}
                            disabled={cambiando === p.id}
                            onClick={() => setMenuAbierto(menuAbierto === p.id ? null : p.id)}
                          >
                            ⋯
                          </button>
                          {menuAbierto === p.id && (
                            <>
                              <span className="productos__menu-fondo" onClick={() => setMenuAbierto(null)} />
                              <span className="productos__menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={p.activo ? 'productos__menu-opcion productos__menu-opcion--baja' : 'productos__menu-opcion'}
                                  onClick={() => void alternarActivo(p)}
                                >
                                  {p.activo ? 'Dar de baja' : 'Reactivar'}
                                </button>
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visibles.length === 0 && <div className="productos__vacio">{mensajeVacio}</div>}
      </div>

      <div className="productos__pie">
        <span>
          Mostrando {visibles.length} de {filtrados.length} {filtrados.length === 1 ? 'producto' : 'productos'}
        </span>
        <span className="productos__paginas">
          <button
            type="button"
            className="productos__pagina"
            disabled={paginaActual === 0}
            onClick={() => setPagina(paginaActual - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className="productos__pagina"
            disabled={paginaActual >= totalPaginas - 1}
            onClick={() => setPagina(paginaActual + 1)}
          >
            Siguiente
          </button>
        </span>
      </div>
    </div>
  )
}
