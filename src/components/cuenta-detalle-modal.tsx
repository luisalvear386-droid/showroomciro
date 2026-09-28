import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useConsulta } from '../hooks/use-consulta'
import {
  describirVencimiento,
  iniciales,
  mensajeErrorPago,
  obtenerCuentaDetalle,
  registrarPago,
  type Cuenta,
  type PagoCuenta,
} from '../lib/cuentas'
import {
  fechaDesdeIso,
  formatearFechaConAnio,
  formatearFechaCorta,
  formatearHora,
  formatearMoneda,
  parsearMonto,
} from '../lib/formato'
import './cuenta-detalle-modal.css'

type TipoCobro = 'parcial' | 'total'

interface CuentaDetalleModalProps {
  cuentaId: string
  /** false en mobile: el acceso remoto es solo consulta. */
  puedeCobrar: boolean
  onCerrar: () => void
  /** Se llama después de cada cobro registrado (para refrescar agenda y badge). */
  onCobrado: () => void
}

function textoEstado(cuenta: Cuenta): string {
  if (cuenta.estado === 'pagado') return 'Saldado'
  if (cuenta.estado === 'al_dia') return 'Al día'
  return describirVencimiento(cuenta.fecha_limite)
}

function detallePago(pago: PagoCuenta, esUltimo: boolean, saldada: boolean): string {
  const hora = formatearHora(new Date(pago.fecha))
  return `${esUltimo && saldada ? 'Pago final' : 'Abono parcial'} · ${hora}`
}

function formatearMontoEditable(monto: number): string {
  return monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

/** Cuentas — Detalle/Cobro, según prototipos/Fiado Detalle.dc.html (modal sobre la agenda). */
export function CuentaDetalleModal({ cuentaId, puedeCobrar, onCerrar, onCobrado }: CuentaDetalleModalProps) {
  const cargar = useCallback(() => obtenerCuentaDetalle(cuentaId), [cuentaId])
  const detalle = useConsulta(cargar)

  const [tipo, setTipo] = useState<TipoCobro>('parcial')
  const [montoTexto, setMontoTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [enviando, onCerrar])

  const datos = detalle.datos
  const cuenta = datos?.cuenta
  const pagos = datos?.pagos ?? []
  const saldo = cuenta ? Math.max(cuenta.saldo, 0) : 0
  const saldada = cuenta?.estado === 'pagado'

  const esTotal = tipo === 'total'
  const montoParseado = esTotal ? saldo : parsearMonto(montoTexto)
  const monto = montoParseado ?? 0
  // Aviso inmediato con el saldo que se ve en pantalla. Igual se deja enviar: el que
  // decide es `registrar_pago()` con el saldo real (puede haber entrado otro cobro).
  const excede = monto > saldo
  const puedeEnviar = monto > 0 && !enviando
  const saldoFinal = Math.max(saldo - (excede ? 0 : monto), 0)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!cuenta || !puedeEnviar) return
    setEnviando(true)
    setErrorPago(null)
    try {
      await registrarPago(cuenta.id, monto)
      setMontoTexto('')
      setTipo('parcial')
      onCobrado()
    } catch (err) {
      // Se conserva lo cargado; se recarga la cuenta por si el saldo cambió
      setErrorPago(mensajeErrorPago(err))
    } finally {
      setEnviando(false)
      detalle.recargar()
    }
  }

  const tono = saldada ? 'pagado' : (cuenta?.estado ?? 'al_dia')
  const totalAbonado = pagos.reduce((suma, p) => suma + p.monto, 0)

  return (
    <div className="modal-fondo" onClick={() => !enviando && onCerrar()}>
      <div
        className={`cuenta-detalle cuenta-detalle--${tono}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cuenta-detalle-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cuenta-detalle__encabezado">
          <div className="cuenta-detalle__cliente">
            <span className="cuenta-detalle__avatar" aria-hidden="true">
              {cuenta ? iniciales(cuenta.cliente_nombre) : ''}
            </span>
            <div className="cuenta-detalle__cliente-textos">
              <h2 id="cuenta-detalle-titulo" className="cuenta-detalle__nombre">
                {cuenta?.cliente_nombre ?? 'Cuenta'}
              </h2>
              {cuenta && <span className="cuenta-detalle__telefono">{cuenta.cliente_telefono || 'Sin teléfono'}</span>}
            </div>
          </div>
          <button type="button" className="cuenta-detalle__cerrar" onClick={onCerrar} disabled={enviando} aria-label="Cerrar">
            ×
          </button>
        </div>

        {!cuenta ? (
          <div className="cuenta-detalle__cuerpo">
            <p className="cuenta-detalle__mensaje">
              {detalle.error
                ? 'No se pudo cargar la cuenta. Revisá la conexión.'
                : datos === null
                  ? 'La cuenta no existe.'
                  : 'Cargando…'}
            </p>
          </div>
        ) : (
          <div className="cuenta-detalle__cuerpo">
            <div className="cuenta-detalle__resumen">
              <div className="cuenta-detalle__dato cuenta-detalle__dato--saldo">
                <span className="cuenta-detalle__dato-titulo">Saldo adeudado</span>
                <span className="cuenta-detalle__saldo">{formatearMoneda(saldo)}</span>
                <span className="cuenta-detalle__dato-detalle">De {formatearMoneda(cuenta.monto_total)} original</span>
              </div>
              <div className="cuenta-detalle__dato">
                <span className="cuenta-detalle__dato-titulo">Fecha límite</span>
                <span className="cuenta-detalle__fecha">{formatearFechaConAnio(fechaDesdeIso(cuenta.fecha_limite))}</span>
                <span className="cuenta-detalle__estado">
                  <span className="cuenta-detalle__estado-punto" aria-hidden="true" />
                  {textoEstado(cuenta)}
                </span>
              </div>
            </div>

            <div className="cuenta-detalle__seccion">
              <div className="cuenta-detalle__seccion-encabezado">
                <span className="cuenta-detalle__seccion-titulo">Historial de cobros</span>
                <span className="cuenta-detalle__abonado">{formatearMoneda(totalAbonado)} abonado</span>
              </div>
              {pagos.length > 0 ? (
                <ul className="cuenta-detalle__pagos">
                  {pagos.map((p, i) => (
                    <li key={p.id} className="cuenta-detalle__pago">
                      <span className="cuenta-detalle__pago-textos">
                        <span className="cuenta-detalle__pago-punto" aria-hidden="true" />
                        <span className="cuenta-detalle__pago-lineas">
                          <span className="cuenta-detalle__pago-fecha">{formatearFechaCorta(new Date(p.fecha))}</span>
                          <span className="cuenta-detalle__pago-detalle">
                            {detallePago(p, i === pagos.length - 1, saldada)}
                          </span>
                        </span>
                      </span>
                      <span className="cuenta-detalle__pago-monto">{formatearMoneda(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="cuenta-detalle__sin-pagos">Todavía no registró ningún pago.</div>
              )}
            </div>

            {!saldada && puedeCobrar && (
              <form className="cuenta-detalle__cobro" onSubmit={onSubmit} noValidate>
                <span className="cuenta-detalle__seccion-titulo">Registrar cobro</span>

                <div className="cuenta-detalle__tipos">
                  <button
                    type="button"
                    className="cuenta-detalle__tipo"
                    aria-pressed={!esTotal}
                    onClick={() => setTipo('parcial')}
                    disabled={enviando}
                  >
                    <span className="cuenta-detalle__tipo-etiqueta">Pago parcial</span>
                    <span className="cuenta-detalle__tipo-ayuda">Abona una parte</span>
                  </button>
                  <button
                    type="button"
                    className="cuenta-detalle__tipo"
                    aria-pressed={esTotal}
                    onClick={() => setTipo('total')}
                    disabled={enviando}
                  >
                    <span className="cuenta-detalle__tipo-etiqueta">Pago total</span>
                    <span className="cuenta-detalle__tipo-ayuda">{formatearMoneda(saldo)}</span>
                  </button>
                </div>

                <div className="cuenta-detalle__campo">
                  <label htmlFor="cobro-monto" className="campo__label">
                    Monto del cobro
                  </label>
                  <div className="cuenta-detalle__monto">
                    <span className="cuenta-detalle__monto-signo" aria-hidden="true">
                      $
                    </span>
                    <input
                      id="cobro-monto"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="cuenta-detalle__monto-input"
                      value={esTotal ? formatearMontoEditable(saldo) : montoTexto}
                      onChange={(e) => {
                        setMontoTexto(e.target.value)
                        setErrorPago(null)
                      }}
                      disabled={esTotal || enviando}
                      placeholder="0"
                      aria-invalid={excede || errorPago !== null}
                      aria-describedby="cobro-aviso"
                    />
                  </div>
                  <span id="cobro-aviso" className="cuenta-detalle__aviso" role={errorPago ? 'alert' : undefined}>
                    {errorPago ?? (excede ? 'El monto supera el saldo adeudado.' : '')}
                  </span>
                </div>

                <div className="cuenta-detalle__pie">
                  <span className="cuenta-detalle__saldo-final">
                    Saldo después del cobro <strong>{formatearMoneda(saldoFinal)}</strong>
                  </span>
                  <button type="submit" className="boton-primario cuenta-detalle__registrar" disabled={!puedeEnviar}>
                    {enviando ? 'Registrando…' : 'Registrar Cobro'}
                  </button>
                </div>
              </form>
            )}

            {saldada && (
              <div className="cuenta-detalle__saldada" role="status">
                <span className="cuenta-detalle__saldada-check" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5.2 5.2L20 7" />
                  </svg>
                </span>
                <span className="cuenta-detalle__saldada-textos">
                  <span className="cuenta-detalle__saldada-titulo">Cuenta saldada</span>
                  <span className="cuenta-detalle__saldada-detalle">
                    El cliente no tiene deuda pendiente. Sale de la agenda.
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
