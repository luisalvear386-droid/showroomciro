import { useEffect } from 'react'
import './confirmar-modal.css'

interface ConfirmarSalidaModalProps {
  /** Ventas del usuario que todavía no están en la base (pendientes o con error). */
  cantidad: number
  saliendo: boolean
  onVolver: () => void
  onConfirmar: () => void
}

/**
 * Aviso al cerrar sesión con ventas sin sincronizar (Módulo 11), con el formato del modal de
 * confirmación del Cierre de Caja. Las ventas no se pierden: quedan en esta computadora y se
 * sincronizan cuando vuelva a entrar el mismo usuario (la base las registra a su nombre).
 */
export function ConfirmarSalidaModal({ cantidad, saliendo, onVolver, onConfirmar }: ConfirmarSalidaModalProps) {
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saliendo) onVolver()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [saliendo, onVolver])

  const una = cantidad === 1

  return (
    <div className="modal-fondo" onClick={() => !saliendo && onVolver()}>
      <div
        className="confirmar-cierre"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-salida-titulo"
        aria-describedby="confirmar-salida-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirmar-salida-titulo" className="confirmar-cierre__titulo">
          ¿Cerrar sesión?
        </h2>
        <div id="confirmar-salida-texto" className="confirmar-cierre__textos">
          <p className="confirmar-cierre__texto">
            Tenés <strong>{una ? '1 venta' : `${cantidad} ventas`}</strong> que todavía no se{' '}
            {una ? 'registró' : 'registraron'} en el sistema.
          </p>
          <p className="confirmar-cierre__aviso">
            <span className="confirmar-cierre__aviso-punto" aria-hidden="true" />
            {una ? 'Queda guardada' : 'Quedan guardadas'} en esta computadora y se{' '}
            {una ? 'sincroniza' : 'sincronizan'} la próxima vez que entres con tu usuario.
          </p>
        </div>

        <div className="confirmar-cierre__botones">
          <button type="button" className="boton-cancelar" onClick={onVolver} disabled={saliendo} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario confirmar-cierre__confirmar"
            onClick={onConfirmar}
            disabled={saliendo}
          >
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión igual'}
          </button>
        </div>
      </div>
    </div>
  )
}
