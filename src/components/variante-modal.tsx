import { useEffect, useMemo, useState } from 'react'
import { formatearMoneda } from '../lib/formato'
import type { ProductoListado, Variante } from '../lib/productos'
import { FotoProducto, PuntoColor } from './producto-visual'
import './variante-modal.css'

const ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/** Talles con letra en su orden natural (S, M, L, XL); los numéricos, de menor a mayor. */
function compararTalles(a: string, b: string): number {
  const ia = ORDEN_TALLES.indexOf(a.toUpperCase())
  const ib = ORDEN_TALLES.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b, 'es', { numeric: true })
}

function unicos(valores: string[], comparar: (a: string, b: string) => number): string[] {
  return [...new Set(valores)].sort(comparar)
}

interface VarianteModalProps {
  producto: ProductoListado
  /** Unidades de cada variante que ya están en el carrito (no se pueden volver a ofrecer). */
  enCarrito: ReadonlyMap<string, number>
  onCerrar: () => void
  onAgregar: (variante: Variante, cantidad: number) => void
}

/** Selección de talle/color con stock disponible, según prototipos/Modal Variante.dc.html */
export function VarianteModal({ producto, enCarrito, onCerrar, onAgregar }: VarianteModalProps) {
  const disponible = (v: Variante) => Math.max(v.stock - (enCarrito.get(v.id) ?? 0), 0)

  const talles = useMemo(() => unicos(producto.variantes.map((v) => v.talle), compararTalles), [producto])
  const colores = useMemo(
    () => unicos(producto.variantes.map((v) => v.color), (a, b) => a.localeCompare(b, 'es')),
    [producto],
  )

  const buscar = (talle: string, color: string) =>
    producto.variantes.find((v) => v.talle === talle && v.color === color)

  // Arranca en la primera combinación con stock (en el orden de talles/colores)
  const inicial =
    talles.flatMap((t) => colores.map((c) => buscar(t, c))).find((v) => v !== undefined && disponible(v) > 0) ??
    producto.variantes[0]

  const [talle, setTalle] = useState(inicial?.talle ?? '')
  const [color, setColor] = useState(inicial?.color ?? '')
  const [cantidad, setCantidad] = useState(1)

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  const seleccionada = buscar(talle, color)
  const n = seleccionada ? disponible(seleccionada) : 0
  const sinStock = n === 0
  const quedaPoco = !sinStock && seleccionada !== undefined && n <= seleccionada.stock_minimo
  const tono = sinStock ? 'agotado' : quedaPoco ? 'bajo' : 'ok'

  const talleConStock = (t: string) => producto.variantes.some((v) => v.talle === t && disponible(v) > 0)

  function elegirTalle(t: string) {
    // Si el color elegido no tiene stock en el talle nuevo, pasa al primero que sí tenga
    const mantener = buscar(t, color)
    const nuevoColor =
      mantener && disponible(mantener) > 0
        ? color
        : (colores.find((c) => {
            const v = buscar(t, c)
            return v !== undefined && disponible(v) > 0
          }) ?? color)
    setTalle(t)
    setColor(nuevoColor)
    setCantidad(1)
  }

  let textoStock = 'Sin stock en esta combinación'
  if (!sinStock) textoStock = `${n} ${n === 1 ? 'unidad disponible' : 'unidades disponibles'}${quedaPoco ? ' · queda poco' : ''}`

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div
        className="variante-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variante-modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="variante-modal__foto-contenedor">
          <FotoProducto url={producto.foto_url} nombre={producto.nombre} className="variante-modal__foto" />
          <button type="button" className="variante-modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="variante-modal__cuerpo">
          <div className="variante-modal__encabezado">
            <div className="variante-modal__titulos">
              <h2 id="variante-modal-titulo" className="variante-modal__nombre">
                {producto.nombre}
              </h2>
              <span className="sku">{seleccionada?.sku ?? ''}</span>
            </div>
            <span className="variante-modal__precio">{formatearMoneda(producto.precio)}</span>
          </div>

          <div className="variante-modal__grupo">
            <span className="variante-modal__grupo-titulo">Talle</span>
            <div className="variante-modal__opciones">
              {talles.map((t) => {
                const deshabilitado = !talleConStock(t)
                return (
                  <button
                    key={t}
                    type="button"
                    className="variante-modal__chip variante-modal__chip--talle"
                    aria-pressed={t === talle}
                    disabled={deshabilitado}
                    onClick={() => elegirTalle(t)}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="variante-modal__grupo">
            <span className="variante-modal__grupo-titulo">Color</span>
            <div className="variante-modal__opciones">
              {colores.map((c) => {
                const v = buscar(talle, c)
                const deshabilitado = v === undefined || disponible(v) === 0
                return (
                  <button
                    key={c}
                    type="button"
                    className="variante-modal__chip"
                    aria-pressed={c === color}
                    disabled={deshabilitado}
                    onClick={() => {
                      setColor(c)
                      setCantidad(1)
                    }}
                  >
                    <PuntoColor color={c} />
                    <span>{c}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={`variante-modal__stock variante-modal__stock--${tono}`}>
            <span className="variante-modal__stock-texto">{textoStock}</span>
            <div className="contador">
              <button
                type="button"
                className="contador__paso"
                onClick={() => setCantidad((q) => Math.max(1, q - 1))}
                disabled={sinStock || cantidad <= 1}
                aria-label="Restar uno"
              >
                −
              </button>
              <span className="contador__valor" aria-live="polite">
                {cantidad}
              </span>
              <button
                type="button"
                className="contador__paso"
                onClick={() => setCantidad((q) => Math.min(n, q + 1))}
                disabled={sinStock || cantidad >= n}
                aria-label="Sumar uno"
              >
                +
              </button>
            </div>
          </div>

          <div className="variante-modal__botones">
            <button type="button" className="boton-cancelar" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton-primario variante-modal__agregar"
              disabled={sinStock || seleccionada === undefined}
              onClick={() => seleccionada && onAgregar(seleccionada, Math.min(cantidad, n))}
            >
              {sinStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
