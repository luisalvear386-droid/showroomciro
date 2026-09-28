import { useEffect, useState } from 'react'
import { formatearMoneda, parsearMonto } from '../lib/formato'
import { MEDIOS_PAGO, type ItemCarrito, type MedioPago, type Venta } from '../lib/ventas'
import './checkout-modal.css'

interface CheckoutModalProps {
  items: ItemCarrito[]
  total: number
  enviando: boolean
  error: string | null
  /** Venta ya registrada: muestra la confirmación mientras se imprime el ticket. */
  registrada: Venta | null
  /** La venta quedó en la cola sin conexión: todavía no se registró en la base. */
  pendiente: boolean
  onVolver: () => void
  onConfirmar: (medio: MedioPago) => void
}

/**
 * Cobro de la venta, según prototipos/Checkout Venta.dc.html. Solo medios de pago directos:
 * sin opción de fiado/cuenta (requirements.md sección 4).
 */
export function CheckoutModal({
  items,
  total,
  enviando,
  error,
  registrada,
  pendiente,
  onVolver,
  onConfirmar,
}: CheckoutModalProps) {
  const [medio, setMedio] = useState<MedioPago>('efectivo')
  const [pagaConTexto, setPagaConTexto] = useState('')

  const bloqueado = enviando || registrada !== null

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !bloqueado) onVolver()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [bloqueado, onVolver])

  if (registrada) {
    const etiqueta = MEDIOS_PAGO.find((m) => m.medio === registrada.medio_pago)?.etiqueta ?? registrada.medio_pago
    return (
      <div className="modal-fondo">
        <div className="checkout checkout--exito" role="dialog" aria-modal="true" aria-labelledby="checkout-exito-titulo">
          {pendiente ? (
            <span className="checkout__check checkout__check--pendiente" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
            </span>
          ) : (
            <span className="checkout__check" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5.2 5.2L20 7" />
              </svg>
            </span>
          )}
          <div className="checkout__exito-textos">
            <h2 id="checkout-exito-titulo" className="checkout__exito-titulo">
              {pendiente ? 'Venta guardada' : 'Venta registrada'}
            </h2>
            <p className="checkout__exito-detalle">
              {pendiente
                ? `Cobrada en ${etiqueta.toLowerCase()}. No hay conexión: se registra sola cuando vuelva internet.`
                : `Cobrada en ${etiqueta.toLowerCase()}. Ya se descontó el stock de las variantes vendidas.`}
            </p>
          </div>
          <div className="checkout__exito-total">
            <span className="checkout__rotulo">Total</span>
            <span className="checkout__exito-monto">{formatearMoneda(registrada.total)}</span>
          </div>
          <p className="checkout__exito-aviso">Imprimiendo ticket… Al terminar volvés al Dashboard.</p>
        </div>
      </div>
    )
  }

  const pagaCon = pagaConTexto.trim() === '' ? null : parsearMonto(pagaConTexto)
  const vuelto = pagaCon === null ? null : pagaCon - total

  return (
    <div className="modal-fondo" onClick={() => !bloqueado && onVolver()}>
      <div
        className="checkout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="checkout__encabezado">
          <h2 id="checkout-titulo" className="checkout__titulo">
            Cobrar venta
          </h2>
          <button type="button" className="checkout__cerrar" onClick={onVolver} disabled={bloqueado} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="checkout__cuerpo">
          <div className="checkout__items">
            {items.map((i) => (
              <div key={i.variante_id} className="checkout__item">
                <span className="checkout__item-datos">
                  <span className="checkout__item-cantidad">{i.cantidad}×</span>
                  <span className="checkout__item-textos">
                    <span className="checkout__item-nombre">{i.producto_nombre}</span>
                    <span className="checkout__item-variante">
                      Talle {i.talle} · {i.color}
                    </span>
                  </span>
                </span>
                <span className="checkout__item-subtotal">{formatearMoneda(i.precio * i.cantidad)}</span>
              </div>
            ))}
            <div className="checkout__total">
              <span className="checkout__rotulo">Total a pagar</span>
              <span className="checkout__total-monto">{formatearMoneda(total)}</span>
            </div>
          </div>

          <div className="checkout__seccion">
            <span className="checkout__rotulo">Medio de pago</span>
            <div className="checkout__medios">
              {MEDIOS_PAGO.map((m) => (
                <button
                  key={m.medio}
                  type="button"
                  className="checkout__medio"
                  aria-pressed={medio === m.medio}
                  onClick={() => setMedio(m.medio)}
                  disabled={bloqueado}
                >
                  <span className="checkout__medio-punto" aria-hidden="true" />
                  <span className="checkout__medio-etiqueta">{m.etiqueta}</span>
                  <span className="checkout__medio-ayuda">{m.ayuda}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Solo ayuda para calcular el vuelto: no se guarda */}
          {medio === 'efectivo' && (
            <div className="checkout__efectivo">
              <label htmlFor="checkout-paga-con" className="checkout__efectivo-label">
                Paga con
              </label>
              <input
                id="checkout-paga-con"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="checkout__efectivo-input"
                value={pagaConTexto}
                onChange={(e) => setPagaConTexto(e.target.value)}
                placeholder="$ 0"
                disabled={bloqueado}
              />
              <span className="checkout__vuelto">
                Vuelto{' '}
                <strong className={vuelto !== null && vuelto < 0 ? 'checkout__vuelto-monto checkout__vuelto-monto--falta' : 'checkout__vuelto-monto'}>
                  {vuelto === null ? '—' : formatearMoneda(Math.max(vuelto, 0))}
                </strong>
              </span>
            </div>
          )}

          {error && (
            <div className="mensaje-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="checkout__pie">
          <button type="button" className="boton-cancelar" onClick={onVolver} disabled={bloqueado}>
            Volver al carrito
          </button>
          <button
            type="button"
            className="boton-primario checkout__confirmar"
            onClick={() => onConfirmar(medio)}
            disabled={bloqueado}
          >
            {enviando ? 'Registrando…' : 'Confirmar Venta'}
          </button>
        </div>
      </div>
    </div>
  )
}
