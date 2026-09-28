import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/use-auth'
import { useConsulta } from '../hooks/use-consulta'
import { normalizarNombreUsuario, type Perfil } from '../lib/auth'
import { cambiarActivoUsuario, crearVendedor, obtenerUsuarios, resumirUsuarios } from '../lib/usuarios'
import './usuarios-page.css'

const ETIQUETA_ROL: Record<Perfil['rol'], string> = { dueño: 'Dueño/a', vendedor: 'Vendedor' }

function FormNuevoVendedor({
  existentes,
  onCreado,
  onCerrar,
}: {
  existentes: Perfil[]
  onCreado: () => void
  onCerrar: () => void
}) {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    const normalizado = normalizarNombreUsuario(usuario)
    if (!normalizado || !contrasena) {
      setError('Completá los dos campos para crear la cuenta.')
      return
    }
    // Validación rápida antes de ir a la base; `crear_vendedor()` vuelve a validar todo
    if (existentes.some((u) => u.nombre_usuario === normalizado)) {
      setError('Ese nombre de usuario ya existe.')
      return
    }

    setGuardando(true)
    const resultado = await crearVendedor(normalizado, contrasena)
    setGuardando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    onCreado()
  }

  return (
    <form className="usuarios__form" onSubmit={(e) => void crear(e)} noValidate>
      <div className="usuarios__form-encabezado">
        <div className="usuarios__form-titulos">
          <h2 className="usuarios__form-titulo">Nuevo vendedor</h2>
          <span className="usuarios__form-bajada">Accede a ventas, productos y cuentas. No ve reportes ni costos.</span>
        </div>
        <button type="button" className="usuarios__cerrar" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="usuarios__campos">
        <div className="usuarios__campo">
          <label htmlFor="f-user">Nombre de usuario</label>
          <input
            id="f-user"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="sol"
            value={usuario}
            onChange={(e) => {
              setUsuario(e.target.value)
              setError('')
            }}
          />
        </div>
        <div className="usuarios__campo">
          <label htmlFor="f-pass">Contraseña</label>
          <input
            id="f-pass"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value)
              setError('')
            }}
          />
        </div>
      </div>

      {error && (
        <div className="usuarios__error" role="alert">
          <span className="usuarios__error-punto" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="usuarios__form-acciones">
        <button type="submit" className="usuarios__crear" disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear vendedor'}
        </button>
        <button type="button" className="boton-cancelar" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Gestión de Usuarios (solo Dueño/a), según prototipos/Usuarios.dc.html: alta de Vendedores
 * y desactivar/reactivar. El nombre de usuario se mapea al email técnico dentro de
 * `crear_vendedor()`; el usuario nunca lo ve.
 *
 * Sin el campo "Nombre completo" del prototipo: `perfiles` no tiene dónde guardarlo
 * (modelo de datos de design.md), así que se identifica a cada uno por su usuario.
 */
export function UsuariosPage() {
  const { perfil } = useAuth()
  const { datos, error, recargar } = useConsulta(obtenerUsuarios)
  const [formAbierto, setFormAbierto] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  const usuarios = datos ?? []

  async function alternarActivo(u: Perfil) {
    setErrorAccion('')
    setProcesando(u.id)
    const resultado = await cambiarActivoUsuario(u.id, !u.activo)
    setProcesando(null)
    if (!resultado.ok) setErrorAccion(resultado.error)
    recargar()
  }

  let estado: string | null = null
  if (error) estado = 'No se pudieron cargar los usuarios. Revisá la conexión.'
  else if (datos === undefined) estado = 'Cargando…'

  return (
    <div className="usuarios">
      <div className="usuarios__encabezado">
        <div className="usuarios__titulos">
          <h1 className="usuarios__titulo">Usuarios</h1>
          <p className="usuarios__bajada">{datos === undefined ? ' ' : resumirUsuarios(usuarios)}</p>
        </div>
        <button
          type="button"
          className={formAbierto ? 'usuarios__nuevo usuarios__nuevo--activo' : 'usuarios__nuevo'}
          onClick={() => setFormAbierto(true)}
        >
          + Nuevo Vendedor
        </button>
      </div>

      {formAbierto && (
        <FormNuevoVendedor
          existentes={usuarios}
          onCerrar={() => setFormAbierto(false)}
          onCreado={() => {
            setFormAbierto(false)
            recargar()
          }}
        />
      )}

      {errorAccion && (
        <div className="usuarios__error" role="alert">
          <span className="usuarios__error-punto" aria-hidden="true" />
          <span>{errorAccion}</span>
        </div>
      )}

      <div className="usuarios__card">
        <div className="usuarios__scroll">
          <table className="usuarios__tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="usuarios__acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="usuarios__fila">
                  <td>
                    <span className="usuarios__persona">
                      <span className={u.activo ? 'usuarios__avatar' : 'usuarios__avatar usuarios__avatar--inactivo'}>
                        {u.nombre_usuario.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="usuarios__nombre">{u.nombre_usuario}</span>
                    </span>
                  </td>
                  <td className="usuarios__rol">{ETIQUETA_ROL[u.rol]}</td>
                  <td>
                    <span className={u.activo ? 'usuarios__estado' : 'usuarios__estado usuarios__estado--inactivo'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="usuarios__acciones">
                    {/* Solo se gestionan Vendedores: la cuenta del Dueño/a no se desactiva desde acá */}
                    {u.rol === 'vendedor' ? (
                      <button
                        type="button"
                        className={u.activo ? 'usuarios__accion' : 'usuarios__accion usuarios__accion--reactivar'}
                        disabled={procesando !== null}
                        onClick={() => void alternarActivo(u)}
                      >
                        {procesando === u.id ? '…' : u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    ) : (
                      u.id === perfil?.id && <span className="usuarios__propia">Tu cuenta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {estado && (
          <div className="usuarios__vacio">
            <span>{estado}</span>
            {error && (
              <button type="button" className="boton-secundario" onClick={recargar}>
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      <p className="usuarios__nota">
        Los vendedores desactivados no pueden iniciar sesión, pero sus ventas y cierres de caja quedan en el historial.
      </p>
    </div>
  )
}
