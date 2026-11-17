import { useEffect, useId, useState, type ReactNode } from 'react'
import { useEnLinea } from '../hooks/use-en-linea'
import { AvisoSinConexion } from './estado-conexion'
import './confirmar-modal.css'

interface ConfirmarModalProps {
  titulo: string
  /** Texto del cuerpo (uno o más `<p className="confirmar-modal__texto">`). */
  children: ReactNode
  /** Texto del botón de confirmar ("Cerrar Caja", "Dar de baja"). */
  textoConfirmar: string
  /** Texto del botón mientras se espera la respuesta ("Cerrando caja…"). */
  textoEnviando: string
  /** Acción destructiva: el botón de confirmar va en vino en vez de canela. */
  peligro?: boolean
  onCancelar: () => void
  /**
   * Hace la acción. Si falla, devuelve el mensaje de error y el modal queda abierto para
   * reintentar; si sale bien devuelve null y el que lo abrió lo cierra.
   */
  onConfirmar: () => Promise<string | null>
}

/**
 * Modal de confirmación reutilizable, con el estilo de prototipos/Caja Cierre.dc.html.
 * Escape o clic afuera cancelan (salvo mientras se confirma). Sin conexión no se puede
 * confirmar: todas sus acciones escriben en la base.
 */
export function ConfirmarModal({
  titulo,
  children,
  textoConfirmar,
  textoEnviando,
  peligro = false,
  onCancelar,
  onConfirmar,
}: ConfirmarModalProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enLinea = useEnLinea()
  const id = useId()

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onCancelar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [enviando, onCancelar])

  async function confirmar() {
    setEnviando(true)
    setError(null)
    const mensaje = await onConfirmar()
    // Si salió bien, el que abrió el modal lo cierra (o la pantalla se desmonta)
    if (mensaje !== null) {
      setError(mensaje)
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fondo" onClick={() => !enviando && onCancelar()}>
      <div
        className="confirmar-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-titulo`} className="confirmar-modal__titulo">
          {titulo}
        </h2>
        <div id={`${id}-texto`} className="confirmar-modal__textos">
          {children}
        </div>

        {error && (
          <div className="mensaje-error" role="alert">
            {error}
          </div>
        )}
        <AvisoSinConexion />

        <div className="confirmar-modal__botones">
          <button type="button" className="boton-cancelar" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="button"
            className={
              peligro
                ? 'boton-primario confirmar-modal__confirmar confirmar-modal__confirmar--peligro'
                : 'boton-primario confirmar-modal__confirmar'
            }
            onClick={() => void confirmar()}
            disabled={enviando || !enLinea}
            autoFocus
          >
            {enviando ? textoEnviando : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
