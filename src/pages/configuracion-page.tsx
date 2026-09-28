import { Link } from 'react-router'
import { useConsulta } from '../hooks/use-consulta'
import { obtenerUsuarios, resumirUsuarios } from '../lib/usuarios'
import './configuracion-page.css'

/**
 * Configuración (mobile, solo Dueño/a), según prototipos/Mobile Configuración.dc.html.
 * Por ahora contiene solo "Gestionar Usuarios", que lleva a la misma pantalla de Gestión de
 * Usuarios del desktop (/usuarios): es la única acción real permitida desde el celular.
 */
export function ConfiguracionPage() {
  const { datos, error } = useConsulta(obtenerUsuarios)

  let resumen = ' '
  if (datos) resumen = resumirUsuarios(datos)
  else if (error) resumen = 'No se pudieron cargar los usuarios.'

  return (
    <div className="configuracion">
      <div className="configuracion__titulos">
        <h1 className="configuracion__titulo">Configuración</h1>
        <p className="configuracion__bajada">Ajustes del sistema disponibles desde el celular.</p>
      </div>

      <section className="configuracion__seccion" aria-labelledby="config-equipo">
        <h2 id="config-equipo" className="configuracion__seccion-titulo">
          Equipo
        </h2>
        <Link to="/usuarios" className="configuracion__opcion">
          <span className="configuracion__opcion-icono" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
              <circle cx="10" cy="8" r="3.5" />
              <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
              <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
            </svg>
          </span>
          <span className="configuracion__opcion-textos">
            <span className="configuracion__opcion-nombre">Gestionar Usuarios</span>
            <span className="configuracion__opcion-detalle">{resumen}</span>
          </span>
          <span className="configuracion__opcion-flecha" aria-hidden="true">
            ›
          </span>
        </Link>
      </section>

      {/* Espacio reservado para futuras opciones, como en el prototipo */}
      <section className="configuracion__seccion" aria-labelledby="config-proximamente">
        <h2 id="config-proximamente" className="configuracion__seccion-titulo">
          Próximamente
        </h2>
        <span className="configuracion__reservado" aria-hidden="true" />
        <span className="configuracion__reservado" aria-hidden="true" />
        <p className="configuracion__nota">Acá van a sumarse los ajustes de local, categorías y datos de la tienda.</p>
      </section>
    </div>
  )
}
