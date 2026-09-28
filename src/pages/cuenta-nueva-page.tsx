import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRefrescarAlertasCuentas } from '../hooks/use-refrescar-alertas-cuentas'
import { crearCuenta, DIAS_AVISO_POR_VENCER, mensajeErrorAlta, type CuentaNueva } from '../lib/cuentas'
import {
  fechaDesdeIso,
  fechaIsoLocal,
  formatearFechaNumerica,
  formatearMoneda,
  parsearMonto,
} from '../lib/formato'
import './cuenta-nueva-page.css'

const PLAZOS = [7, 15, 30]
const PLAZO_POR_DEFECTO = 15
/** Cuánto se ve la confirmación antes de volver solo al Dashboard. */
const MS_ANTES_DE_VOLVER = 1800

type Campo = 'nombre' | 'monto' | 'fecha'

function fechaEnDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fechaIsoLocal(fecha)
}

/**
 * Cuentas — Alta, según prototipos/Nueva Cuenta.dc.html. Se entra solo desde "Nueva Cuenta"
 * del Dashboard; al guardar muestra la confirmación y vuelve solo al Dashboard.
 */
export function CuentaNuevaPage() {
  const navigate = useNavigate()
  const refrescarAlertasCuentas = useRefrescarAlertasCuentas()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [montoTexto, setMontoTexto] = useState('')
  const [fecha, setFecha] = useState(() => fechaEnDias(PLAZO_POR_DEFECTO))
  const [plazo, setPlazo] = useState<number | null>(PLAZO_POR_DEFECTO)
  const [error, setError] = useState<{ campo: Campo | null; mensaje: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardada, setGuardada] = useState<CuentaNueva | null>(null)

  useEffect(() => {
    if (!guardada) return
    const id = window.setTimeout(() => navigate('/', { replace: true }), MS_ANTES_DE_VOLVER)
    return () => window.clearTimeout(id)
  }, [guardada, navigate])

  function limpiarError() {
    setError(null)
  }

  function validar(): CuentaNueva | null {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) {
      setError({ campo: 'nombre', mensaje: 'Poné el nombre del cliente.' })
      return null
    }
    const monto = parsearMonto(montoTexto)
    if (monto === null || monto <= 0) {
      setError({ campo: 'monto', mensaje: 'Ingresá el monto adeudado.' })
      return null
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError({ campo: 'fecha', mensaje: 'Elegí la fecha límite de pago.' })
      return null
    }
    if (fecha < fechaIsoLocal(new Date())) {
      setError({ campo: 'fecha', mensaje: 'La fecha límite no puede ser anterior a hoy.' })
      return null
    }
    return {
      cliente_nombre: nombreLimpio,
      cliente_telefono: telefono.trim() || null,
      monto_total: monto,
      fecha_limite: fecha,
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    setError(null)
    try {
      await crearCuenta(datos)
      refrescarAlertasCuentas()
      setGuardada(datos)
    } catch (err) {
      setError({ campo: null, mensaje: mensajeErrorAlta(err) })
      setEnviando(false)
    }
  }

  if (guardada) {
    return (
      <div className="cuenta-nueva">
        <div className="cuenta-nueva__confirmacion" role="status">
          <span className="cuenta-nueva__check" aria-hidden="true">
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5.2 5.2L20 7" />
            </svg>
          </span>
          <div className="cuenta-nueva__confirmacion-textos">
            <h2 className="cuenta-nueva__confirmacion-titulo">Cuenta guardada</h2>
            <p className="cuenta-nueva__confirmacion-detalle">
              {guardada.cliente_nombre} debe {formatearMoneda(guardada.monto_total)} con vencimiento el{' '}
              {formatearFechaNumerica(fechaDesdeIso(guardada.fecha_limite))}.
            </p>
          </div>
          <button type="button" className="boton-primario" onClick={() => navigate('/', { replace: true })}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)

  return (
    <div className="cuenta-nueva">
      <div className="cuenta-nueva__titulos">
        <h1 className="cuenta-nueva__titulo">Nueva Cuenta</h1>
        <p className="cuenta-nueva__bajada">Registrá lo que el cliente se lleva fiado y cuándo lo va a pagar.</p>
      </div>

      <form className="cuenta-nueva__card" onSubmit={onSubmit} noValidate>
        <div className="cuenta-nueva__fila">
          <div className="campo">
            <label htmlFor="c-nombre" className="campo__label">
              Nombre del cliente
            </label>
            <input
              id="c-nombre"
              type="text"
              className="campo__input"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                limpiarError()
              }}
              placeholder="Nombre y apellido"
              autoComplete="off"
              maxLength={120}
              aria-invalid={error?.campo === 'nombre'}
              disabled={enviando}
              autoFocus
            />
          </div>
          <div className="campo">
            <label htmlFor="c-tel" className="campo__label">
              Teléfono del cliente
            </label>
            <input
              id="c-tel"
              type="tel"
              className="campo__input"
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value)
                limpiarError()
              }}
              placeholder="11 5555 5555"
              autoComplete="off"
              maxLength={40}
              disabled={enviando}
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="c-monto" className="campo__label">
            Monto adeudado
          </label>
          <div className="cuenta-nueva__monto">
            <span className="cuenta-nueva__monto-signo" aria-hidden="true">
              $
            </span>
            <input
              id="c-monto"
              type="text"
              inputMode="decimal"
              className="cuenta-nueva__monto-input"
              value={montoTexto}
              onChange={(e) => {
                setMontoTexto(e.target.value)
                limpiarError()
              }}
              placeholder="0"
              autoComplete="off"
              aria-invalid={error?.campo === 'monto'}
              disabled={enviando}
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="c-venc" className="campo__label">
            Fecha límite de pago
          </label>
          <div className="cuenta-nueva__plazos">
            <input
              id="c-venc"
              type="date"
              className="campo__input cuenta-nueva__fecha"
              value={fecha}
              min={fechaIsoLocal(new Date())}
              onChange={(e) => {
                setFecha(e.target.value)
                setPlazo(null)
                limpiarError()
              }}
              aria-invalid={error?.campo === 'fecha'}
              disabled={enviando}
            />
            {PLAZOS.map((dias) => (
              <button
                key={dias}
                type="button"
                className="cuenta-nueva__plazo"
                aria-pressed={plazo === dias}
                onClick={() => {
                  setFecha(fechaEnDias(dias))
                  setPlazo(dias)
                  limpiarError()
                }}
                disabled={enviando}
              >
                {dias} días
              </button>
            ))}
          </div>
          {fechaValida && (
            <span className="cuenta-nueva__ayuda">
              Vence el {formatearFechaNumerica(fechaDesdeIso(fecha))}. Va a aparecer como “por vencer”{' '}
              {DIAS_AVISO_POR_VENCER} días antes.
            </span>
          )}
        </div>

        {error && (
          <div className="mensaje-error" role="alert">
            {error.mensaje}
          </div>
        )}

        <div className="cuenta-nueva__botones">
          <Link to="/" className="boton-cancelar cuenta-nueva__cancelar" aria-disabled={enviando}>
            Cancelar
          </Link>
          <button type="submit" className="boton-primario cuenta-nueva__guardar" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar Cuenta'}
          </button>
        </div>

        <p className="cuenta-nueva__pie">Al guardar volvés al Dashboard. La cuenta queda en la agenda con su vencimiento.</p>
      </form>
    </div>
  )
}
