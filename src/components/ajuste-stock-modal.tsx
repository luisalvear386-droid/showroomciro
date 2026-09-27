import { useEffect, useState, type FormEvent } from 'react'
import { ajustarStock, mensajeDeError, type TipoAjuste, type Variante } from '../lib/productos'
import { FotoProducto, PuntoColor } from './producto-visual'
import './ajuste-stock-modal.css'

const TIPOS: { tipo: TipoAjuste; etiqueta: string; ayuda: string; signo: string }[] = [
  { tipo: 'suma', etiqueta: 'Sumar stock', ayuda: 'Reposición, devolución', signo: '+' },
  { tipo: 'resta', etiqueta: 'Restar stock', ayuda: 'Merma, rotura', signo: '−' },
]
const MOTIVOS = ['Reposición', 'Merma/rotura', 'Corrección', 'Devolución']

interface AjusteStockModalProps {
  productoNombre: string
  fotoUrl: string | null
  variante: Variante
  onCerrar: () => void
  /** Se llama con el stock que quedó en la base después del ajuste. */
  onAjustado: (stockNuevo: number) => void
}

function tono(stock: number, minimo: number): 'agotado' | 'bajo' | 'ok' {
  if (stock === 0) return 'agotado'
  if (stock <= minimo) return 'bajo'
  return 'ok'
}

/** Ajuste de stock de una variante, según prototipos/Stock Ajuste.dc.html */
export function AjusteStockModal({ productoNombre, fotoUrl, variante, onCerrar, onAjustado }: AjusteStockModalProps) {
  const [tipo, setTipo] = useState<TipoAjuste>('suma')
  const [cantidadTexto, setCantidadTexto] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [enviando, onCerrar])

  const actual = variante.stock
  const cantidad = Number.parseInt(cantidadTexto.replace(/\D/g, ''), 10) || 0
  const suma = tipo === 'suma'
  const excede = !suma && cantidad > actual
  const resultante = suma ? actual + cantidad : Math.max(actual - cantidad, 0)
  // Motivo obligatorio: un chip, un detalle escrito, o ambos
  const motivoFinal = [motivo, nota.trim()].filter(Boolean).join(' — ')
  const puedeConfirmar = cantidad > 0 && !excede && motivoFinal !== '' && !enviando

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!puedeConfirmar) return
    setEnviando(true)
    setError(null)
    try {
      onAjustado(await ajustarStock(variante.id, tipo, cantidad, motivoFinal))
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fondo" onClick={() => !enviando && onCerrar()}>
      <div
        className="ajuste"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajuste-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ajuste__encabezado">
          <h2 id="ajuste-titulo" className="ajuste__titulo">
            Ajuste de stock
          </h2>
          <button type="button" className="ajuste__cerrar" onClick={onCerrar} disabled={enviando} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form className="ajuste__cuerpo" onSubmit={onSubmit} noValidate>
          <div className="ajuste__variante">
            <FotoProducto url={fotoUrl} nombre={productoNombre} className="ajuste__foto" />
            <span className="ajuste__variante-datos">
              <span className="ajuste__variante-textos">
                <span className="ajuste__producto">{productoNombre}</span>
                <span className="sku">{variante.sku}</span>
              </span>
              <span className="ajuste__chips">
                <span className="ajuste__chip">Talle {variante.talle}</span>
                <span className="ajuste__chip">
                  <PuntoColor color={variante.color} />
                  {variante.color}
                </span>
              </span>
            </span>
            <span className="ajuste__actual">
              <span className="ajuste__actual-titulo">Actual</span>
              <span className={`ajuste__actual-valor ajuste--${tono(actual, variante.stock_minimo)}`}>{actual} u.</span>
            </span>
          </div>

          <div className="ajuste__seccion">
            <span className="ajuste__seccion-titulo">Tipo de ajuste</span>
            <div className="ajuste__tipos">
              {TIPOS.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  className={`ajuste__tipo ajuste__tipo--${t.tipo}`}
                  aria-pressed={tipo === t.tipo}
                  onClick={() => setTipo(t.tipo)}
                  disabled={enviando}
                >
                  <span className="ajuste__tipo-signo">{t.signo}</span>
                  <span className="ajuste__tipo-textos">
                    <span className="ajuste__tipo-etiqueta">{t.etiqueta}</span>
                    <span className="ajuste__tipo-ayuda">{t.ayuda}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="ajuste__seccion ajuste__seccion--cantidad">
            <label htmlFor="ajuste-cantidad" className="campo__label">
              Cantidad
            </label>
            <div className="ajuste__cantidad">
              <button
                type="button"
                className="ajuste__paso"
                onClick={() => setCantidadTexto(String(Math.max(1, cantidad - 1)))}
                disabled={enviando}
                aria-label="Restar uno"
              >
                −
              </button>
              <input
                id="ajuste-cantidad"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="ajuste__cantidad-input"
                value={cantidadTexto}
                onChange={(e) => setCantidadTexto(e.target.value)}
                aria-invalid={excede}
                disabled={enviando}
              />
              <button
                type="button"
                className="ajuste__paso"
                onClick={() => setCantidadTexto(String(cantidad + 1))}
                disabled={enviando}
                aria-label="Sumar uno"
              >
                +
              </button>
            </div>
            {excede && <span className="ajuste__excede">No podés restar más de las {actual} u. en stock.</span>}
          </div>

          <div className="ajuste__seccion">
            <span className="ajuste__seccion-titulo">Motivo</span>
            <div className="ajuste__motivos">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="ajuste__motivo"
                  aria-pressed={motivo === m}
                  onClick={() => setMotivo(motivo === m ? '' : m)}
                  disabled={enviando}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="campo__input ajuste__nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Detalle del ajuste"
              aria-label="Detalle del ajuste"
              maxLength={200}
              disabled={enviando}
            />
          </div>

          <div className={`ajuste__resultado ajuste__resultado--${excede ? 'agotado' : tono(resultante, variante.stock_minimo)}`}>
            <span className="ajuste__resultado-textos">
              <span className="ajuste__resultado-titulo">Stock resultante</span>
              <span className="ajuste__resultado-detalle">
                {excede ? 'Revisá la cantidad' : `${suma ? '+' : '−'}${cantidad} u. sobre ${actual} actuales`}
              </span>
            </span>
            <span className="ajuste__resultado-valor">{resultante} u.</span>
          </div>

          {error && (
            <div className="mensaje-error" role="alert">
              {error}
            </div>
          )}

          <div className="ajuste__botones">
            <button type="button" className="ajuste__cancelar" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="submit"
              className="boton-primario ajuste__confirmar"
              disabled={!puedeConfirmar}
              title={motivoFinal === '' ? 'Elegí o escribí un motivo' : undefined}
            >
              {enviando ? 'Guardando…' : 'Confirmar ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
