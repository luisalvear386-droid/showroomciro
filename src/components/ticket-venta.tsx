import { createPortal } from 'react-dom'
import { formatearMoneda, formatearHora } from '../lib/formato'
import { MEDIOS_PAGO, type ItemCarrito, type VentaRegistrada } from '../lib/ventas'
import './ticket-venta.css'

interface TicketVentaProps {
  registrada: VentaRegistrada
  /** Datos descriptivos de cada variante (nombre, talle, color), tomados del carrito. */
  carrito: ItemCarrito[]
  vendedor: string
  /**
   * Venta en la cola, sin registrar todavía en la base: importes con los precios del
   * catálogo local y marca "pendiente de sincronizar".
   */
  pendiente: boolean
}

/**
 * Ticket para impresora térmica (design.md → "Impresión de ticket"). Se monta en <body>,
 * fuera de #root: la hoja de impresión oculta todo lo demás y el navegador imprime solo
 * esto vía `window.print()`. En pantalla no se ve.
 *
 * Importes y total salen de la venta registrada (precios de la base), no del carrito;
 * salvo en una venta pendiente, que todavía no pasó por la base.
 */
export function TicketVenta({ registrada, carrito, vendedor, pendiente }: TicketVentaProps) {
  const { venta, items } = registrada
  const fecha = new Date(venta.fecha)
  const porVariante = new Map(carrito.map((i) => [i.variante_id, i]))
  const medio = MEDIOS_PAGO.find((m) => m.medio === venta.medio_pago)?.etiqueta ?? venta.medio_pago

  return createPortal(
    <div className="ticket">
      <div className="ticket__marca">ShowroomCiro</div>
      {pendiente && <div className="ticket__pendiente">Pendiente de sincronizar</div>}
      <div className="ticket__linea">
        <span>{fecha.toLocaleDateString('es-AR')}</span>
        <span>{formatearHora(fecha)}</span>
      </div>
      <div className="ticket__linea">
        <span>Venta #{venta.id.slice(0, 8).toUpperCase()}</span>
        <span>{vendedor}</span>
      </div>

      <div className="ticket__separador" />

      {items.map((i) => {
        const datos = porVariante.get(i.variante_id)
        return (
          <div key={i.variante_id} className="ticket__item">
            <div className="ticket__linea">
              <span className="ticket__item-nombre">
                {i.cantidad} × {datos?.producto_nombre ?? 'Artículo'}
              </span>
              <span>{formatearMoneda(i.precio_unitario * i.cantidad)}</span>
            </div>
            {datos && (
              <div className="ticket__detalle">
                Talle {datos.talle} · {datos.color}
                {i.cantidad > 1 && ` · ${formatearMoneda(i.precio_unitario)} c/u`}
              </div>
            )}
          </div>
        )
      })}

      <div className="ticket__separador" />

      <div className="ticket__linea ticket__total">
        <span>TOTAL</span>
        <span>{formatearMoneda(venta.total)}</span>
      </div>
      <div className="ticket__linea">
        <span>Medio de pago</span>
        <span>{medio}</span>
      </div>

      <div className="ticket__separador" />
      <div className="ticket__pie">¡Gracias por tu compra!</div>
    </div>,
    document.body,
  )
}
