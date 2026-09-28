import { Link } from 'react-router'
import { useSincronizacion } from '../sincronizacion/use-sincronizacion'
import './estado-sincronizacion.css'

const RUTA_LISTA = '/ventas/pendientes'

function ventas(n: number): string {
  return n === 1 ? '1 venta' : `${n} ventas`
}

/**
 * Indicador del header (solo mostrador, Módulo 11): estado de conexión y ventas que todavía
 * no llegaron a la base. Mismos tonos que los badges de diferencia del Historial de Caja:
 * oliva todo bien, canela esperando, coral sin conexión, vino hay que hacer algo.
 * Con algo en la cola, lleva a la lista de ventas sin sincronizar.
 */
export function EstadoSincronizacion() {
  const { pendientes, conError, deOtros, conDiferencia, conexion, sincronizando } = useSincronizacion()

  let tono: 'ok' | 'pendiente' | 'sin-conexion'
  let texto: string
  if (conexion === 'sin-conexion') {
    tono = 'sin-conexion'
    texto = pendientes > 0 ? `Sin conexión · ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}` : 'Sin conexión'
  } else if (pendientes > 0) {
    tono = 'pendiente'
    texto = sincronizando ? `Sincronizando ${ventas(pendientes)}…` : `${ventas(pendientes)} por sincronizar`
  } else {
    tono = 'ok'
    texto = 'En línea'
  }

  const aRevisar = conError + conDiferencia
  const hayCola = pendientes + conError + deOtros > 0

  const estado = (
    <>
      <span className="sync-estado__punto" aria-hidden="true" />
      {texto}
    </>
  )

  return (
    <div className="sync-estados" role="status" aria-live="polite">
      {hayCola ? (
        <Link to={RUTA_LISTA} className={`sync-estado sync-estado--${tono}`}>
          {estado}
        </Link>
      ) : (
        <span className={`sync-estado sync-estado--${tono}`}>{estado}</span>
      )}
      {aRevisar > 0 && (
        <Link to={RUTA_LISTA} className="sync-estado sync-estado--error">
          <span className="sync-estado__punto" aria-hidden="true" />
          {ventas(aRevisar)} para revisar
        </Link>
      )}
    </div>
  )
}
