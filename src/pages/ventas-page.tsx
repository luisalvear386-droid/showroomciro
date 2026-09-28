import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { useCaja } from '../caja/use-caja'
import { CheckoutModal } from '../components/checkout-modal'
import { FotoProducto } from '../components/producto-visual'
import { TicketVenta } from '../components/ticket-venta'
import { VarianteModal } from '../components/variante-modal'
import { useCatalogoLocal } from '../hooks/use-catalogo-local'
import { venderDesdeMostrador } from '../lib/cola-ventas'
import { formatearMoneda } from '../lib/formato'
import { codigoProducto, type ProductoListado, type Variante } from '../lib/productos'
import {
  esErrorSinStock,
  mensajeErrorVenta,
  type ItemCarrito,
  type MedioPago,
  type VentaRegistrada,
} from '../lib/ventas'
import './ventas-page.css'

const TODAS = 'Todos'

/** Minúsculas y sin tildes, para buscar "pantalon" y encontrar "Pantalón". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

interface Carrito {
  items: ItemCarrito[]
  /**
   * Id de la venta, generado en el cliente (ver `registrar_venta()`). Se renueva con cada
   * cambio del carrito: reintentar el mismo carrito reusa el id (si el primer intento sí
   * llegó a registrarse, no se duplica), pero un carrito distinto es siempre otra venta.
   */
  ventaId: string
}

function carritoNuevo(items: ItemCarrito[] = []): Carrito {
  return { items, ventaId: crypto.randomUUID() }
}

function claseStock(stock: number, bajo: boolean): string {
  if (stock === 0) return 'pos-producto__stock stock--agotado'
  if (bajo) return 'pos-producto__stock stock--bajo'
  return 'pos-producto__stock'
}

/**
 * Ventas (POS), según prototipos/Ventas POS.dc.html. Se entra solo desde "Nueva Venta" del
 * Dashboard; al confirmar la venta se imprime el ticket y se vuelve al Dashboard.
 *
 * Funciona sin conexión (Módulo 11): el catálogo sale de la base local y la venta queda en
 * la cola hasta que se pueda registrar; el ticket sale marcado "pendiente de sincronizar".
 */
export function VentasPage() {
  const { perfil, sesionOffline } = useAuth()
  const { caja } = useCaja()
  const navigate = useNavigate()
  const catalogo = useCatalogoLocal()

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState(TODAS)
  const [elegido, setElegido] = useState<ProductoListado | null>(null)
  const [carrito, setCarrito] = useState<Carrito>(() => carritoNuevo())
  const [cobrando, setCobrando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [registrada, setRegistrada] = useState<VentaRegistrada | null>(null)
  /** true si la venta quedó en la cola (sin registrar todavía en la base). */
  const [pendiente, setPendiente] = useState(false)
  const buscador = useRef<HTMLInputElement>(null)

  const productos = useMemo(() => catalogo.productos ?? [], [catalogo.productos])

  // F2 enfoca el buscador (atajo que muestra el prototipo)
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        buscador.current?.focus()
        buscador.current?.select()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  // Venta confirmada: imprime el ticket y vuelve al Dashboard. `window.print()` bloquea
  // hasta que se cierra el diálogo; el timeout deja pintar antes la confirmación y el ticket.
  useEffect(() => {
    if (!registrada) return
    const id = window.setTimeout(() => {
      window.print()
      navigate('/', { replace: true })
    }, 150)
    return () => window.clearTimeout(id)
  }, [registrada, navigate])

  const categorias = useMemo(() => {
    const nombres = new Set<string>()
    for (const p of productos) if (p.categoria) nombres.add(p.categoria)
    return [TODAS, ...[...nombres].sort((a, b) => a.localeCompare(b, 'es'))]
  }, [productos])

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    return productos.filter(
      (p) =>
        (categoria === TODAS || p.categoria === categoria) &&
        (!termino ||
          normalizar(p.nombre).includes(termino) ||
          codigoProducto(p.codigo).toLowerCase().includes(termino) ||
          p.variantes.some((v) => v.sku.toLowerCase().includes(termino))),
    )
  }, [productos, busqueda, categoria])

  /** Stock de cada variante según el último catálogo cargado (tope de las cantidades). */
  const stockPorVariante = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of productos) for (const v of p.variantes) mapa.set(v.id, v.stock)
    return mapa
  }, [productos])

  const enCarrito = useMemo(
    () => new Map(carrito.items.map((i) => [i.variante_id, i.cantidad])),
    [carrito.items],
  )

  const cantidadItems = carrito.items.reduce((t, i) => t + i.cantidad, 0)
  const total = carrito.items.reduce((t, i) => t + i.precio * i.cantidad, 0)

  function cambiarItems(cambiar: (items: ItemCarrito[]) => ItemCarrito[]) {
    setCarrito((c) => carritoNuevo(cambiar(c.items)))
    setErrorVenta(null)
  }

  function agregar(producto: ProductoListado, variante: Variante, cantidad: number) {
    cambiarItems((items) => {
      const existente = items.find((i) => i.variante_id === variante.id)
      if (existente) {
        return items.map((i) =>
          i.variante_id === variante.id ? { ...i, cantidad: Math.min(i.cantidad + cantidad, variante.stock) } : i,
        )
      }
      return [
        ...items,
        {
          variante_id: variante.id,
          producto_nombre: producto.nombre,
          foto_url: producto.foto_url,
          talle: variante.talle,
          color: variante.color,
          sku: variante.sku,
          precio: producto.precio,
          cantidad,
        },
      ]
    })
    setElegido(null)
  }

  function cambiarCantidad(varianteId: string, cantidad: number) {
    cambiarItems((items) => items.map((i) => (i.variante_id === varianteId ? { ...i, cantidad } : i)))
  }

  function quitar(varianteId: string) {
    cambiarItems((items) => items.filter((i) => i.variante_id !== varianteId))
  }

  const cerrarVariante = useCallback(() => setElegido(null), [])
  const volverAlCarrito = useCallback(() => {
    setCobrando(false)
    setErrorVenta(null)
  }, [])

  async function confirmar(medio: MedioPago) {
    if (!caja || !perfil || carrito.items.length === 0) return
    setEnviando(true)
    setErrorVenta(null)
    const resultado = await venderDesdeMostrador(
      {
        id: carrito.ventaId,
        caja_id: caja.caja_id,
        usuario_id: perfil.id,
        medio_pago: medio,
        items: carrito.items,
        total_cobrado: total,
        creada_en: new Date().toISOString(),
        estado: 'pendiente',
        intentos: 0,
      },
      { sesionOffline },
    )
    setEnviando(false)

    if (resultado.tipo === 'rechazada') {
      // El carrito queda intacto; con falta de stock se recarga el catálogo para ver lo que quedó
      setErrorVenta(mensajeErrorVenta(resultado.error))
      if (esErrorSinStock(resultado.error)) catalogo.recargar()
      return
    }
    setPendiente(resultado.tipo === 'pendiente')
    setRegistrada(resultado.registrada)
  }

  // Dueño/a en el celular sin caja abierta (única ruta en la que no se exige abrirla)
  if (!caja) {
    return (
      <div className="pantalla-centrada pantalla-centrada--interna">
        <p className="pantalla-centrada__mensaje">Para vender tiene que haber una caja abierta en el mostrador.</p>
      </div>
    )
  }

  let mensajeGrilla: string | null = null
  if (catalogo.productos === undefined) mensajeGrilla = catalogo.error ? null : 'Cargando productos…'
  else if (productos.length === 0) mensajeGrilla = 'No hay productos activos para vender.'
  else if (visibles.length === 0) mensajeGrilla = 'No hay productos que coincidan con la búsqueda.'

  return (
    <div className="pos">
      <section className="pos__catalogo" aria-label="Catálogo">
        <div className="pos__buscador">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={buscador}
            type="search"
            className="pos__buscador-input"
            placeholder="Buscar por nombre o SKU…"
            aria-label="Buscar por nombre o SKU"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          <span className="pos__atajo" aria-hidden="true">
            F2
          </span>
        </div>

        <div className="pos__categorias">
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              className="pos__categoria"
              aria-pressed={c === categoria}
              onClick={() => setCategoria(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {catalogo.error && (
          <div className="mensaje-error pos__error" role="alert">
            No se pudo cargar el catálogo. Revisá la conexión.
            <button type="button" className="boton-secundario" onClick={catalogo.recargar}>
              Reintentar
            </button>
          </div>
        )}

        {mensajeGrilla ? (
          <p className="pos__vacio">{mensajeGrilla}</p>
        ) : (
          <div className="pos__grilla">
            {visibles.map((p) => {
              const disponible = p.variantes.reduce(
                (t, v) => t + Math.max(v.stock - (enCarrito.get(v.id) ?? 0), 0),
                0,
              )
              return (
                <button key={p.id} type="button" className="pos-producto" onClick={() => setElegido(p)}>
                  <FotoProducto url={p.foto_url} nombre={p.nombre} className="pos-producto__foto" />
                  <span className="pos-producto__datos">
                    <span className="pos-producto__nombre">{p.nombre}</span>
                    <span className="sku">{codigoProducto(p.codigo)}</span>
                    <span className="pos-producto__pie">
                      <span className="pos-producto__precio">{formatearMoneda(p.precio)}</span>
                      <span className={claseStock(disponible, p.stock_bajo)}>
                        {disponible === 0 ? 'Sin stock' : `${disponible} u.`}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <aside className="pos__carrito" aria-label="Carrito">
        <div className="pos__carrito-encabezado">
          <h2 className="pos__carrito-titulo">Carrito</h2>
          <span className="pos__carrito-cantidad">
            {cantidadItems} {cantidadItems === 1 ? 'ítem' : 'ítems'}
          </span>
        </div>

        <div className="pos__carrito-items">
          {carrito.items.length === 0 && (
            <p className="pos__carrito-vacio">Elegí un producto de la grilla para empezar la venta.</p>
          )}
          {carrito.items.map((i) => {
            const tope = stockPorVariante.get(i.variante_id) ?? i.cantidad
            return (
              <div key={i.variante_id} className="pos-item">
                <FotoProducto url={i.foto_url} nombre={i.producto_nombre} className="pos-item__foto" />
                <span className="pos-item__datos">
                  <span className="pos-item__fila">
                    <span className="pos-item__nombre">{i.producto_nombre}</span>
                    <button
                      type="button"
                      className="pos-item__quitar"
                      onClick={() => quitar(i.variante_id)}
                      aria-label={`Quitar ${i.producto_nombre}`}
                    >
                      ×
                    </button>
                  </span>
                  <span className="pos-item__variante">
                    Talle {i.talle} · {i.color}
                  </span>
                  <span className="pos-item__fila pos-item__fila--centro">
                    <span className="contador contador--chico">
                      <button
                        type="button"
                        className="contador__paso"
                        onClick={() => cambiarCantidad(i.variante_id, i.cantidad - 1)}
                        disabled={i.cantidad <= 1}
                        aria-label="Restar uno"
                      >
                        −
                      </button>
                      <span className="contador__valor">{i.cantidad}</span>
                      <button
                        type="button"
                        className="contador__paso"
                        onClick={() => cambiarCantidad(i.variante_id, i.cantidad + 1)}
                        disabled={i.cantidad >= tope}
                        aria-label="Sumar uno"
                        title={i.cantidad >= tope ? `Hay ${tope} u. en stock` : undefined}
                      >
                        +
                      </button>
                    </span>
                    <span className="pos-item__subtotal">{formatearMoneda(i.precio * i.cantidad)}</span>
                  </span>
                  {i.cantidad > tope && (
                    <span className="pos-item__aviso">Quedan {tope} u. en stock</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="pos__carrito-pie">
          <div className="pos__totales">
            <div className="pos__subtotal">
              <span>Subtotal</span>
              <span>{formatearMoneda(total)}</span>
            </div>
            <div className="pos__total">
              <span className="pos__total-rotulo">Total</span>
              <span className="pos__total-monto">{formatearMoneda(total)}</span>
            </div>
          </div>
          <button
            type="button"
            className="boton-primario pos__cobrar"
            disabled={carrito.items.length === 0}
            onClick={() => setCobrando(true)}
          >
            Cobrar
          </button>
        </div>
      </aside>

      {elegido && (
        <VarianteModal
          producto={elegido}
          enCarrito={enCarrito}
          onCerrar={cerrarVariante}
          onAgregar={(variante, cantidad) => agregar(elegido, variante, cantidad)}
        />
      )}

      {cobrando && (
        <CheckoutModal
          items={carrito.items}
          total={total}
          enviando={enviando}
          error={errorVenta}
          registrada={registrada?.venta ?? null}
          pendiente={pendiente}
          onVolver={volverAlCarrito}
          onConfirmar={(medio) => void confirmar(medio)}
        />
      )}

      {registrada && (
        <TicketVenta
          registrada={registrada}
          carrito={carrito.items}
          vendedor={perfil?.nombre_usuario ?? ''}
          pendiente={pendiente}
        />
      )}
    </div>
  )
}
