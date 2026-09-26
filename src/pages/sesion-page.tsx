import { useAuth } from '../auth/use-auth'

/** Placeholder protegido del Módulo 3. Se reemplaza por Apertura de Caja / Dashboard en el Módulo 4. */
export function SesionPage() {
  const { perfil, logout } = useAuth()
  if (!perfil) return null

  return (
    <div className="pantalla-centrada">
      <p className="pantalla-centrada__mensaje">
        Sesión iniciada como <strong>{perfil.nombre_usuario}</strong> ({perfil.rol})
      </p>
      <button type="button" className="boton-secundario" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </div>
  )
}
