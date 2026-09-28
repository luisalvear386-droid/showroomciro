import type { ReactNode } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router'
import { RequireRole } from '../auth/require-role'
import { useCaja } from '../caja/use-caja'
import { useConsulta } from '../hooks/use-consulta'
import { contarCuentasEnAlerta } from '../lib/alertas'
import type { Rol } from '../lib/auth'
import { formatearFechaLarga, formatearHora } from '../lib/formato'
import { IconoNavegacion, type IconoNav } from './iconos-nav'
import { MenuUsuario } from './menu-usuario'
import './app-layout.css'

interface ItemNav {
  ruta: string
  etiqueta: string
  /** Si se indica, solo lo ven esos roles. */
  roles?: Rol[]
  /** Muestra el badge de cuentas vencidas/por vencer. */
  conBadgeCuentas?: boolean
}

interface ItemNavMobile extends ItemNav {
  icono: IconoNav
}

/** Sidebar desktop (design.md → Navegación). Sin ítem "Ventas": el POS se abre desde el Dashboard. */
const NAV_DESKTOP: ItemNav[] = [
  { ruta: '/', etiqueta: 'Dashboard' },
  { ruta: '/productos', etiqueta: 'Productos' },
  { ruta: '/caja', etiqueta: 'Caja' },
  { ruta: '/cuentas', etiqueta: 'Cuentas', conBadgeCuentas: true },
  { ruta: '/reportes', etiqueta: 'Reportes', roles: ['dueño'] },
  { ruta: '/usuarios', etiqueta: 'Usuarios', roles: ['dueño'] },
]

/**
 * Menú inferior mobile. "Configuración" solo contiene Gestión de Usuarios (solo Dueño/a),
 * así que al Vendedor se le oculta entero: le quedan Dashboard y Cuentas.
 */
const NAV_MOBILE: ItemNavMobile[] = [
  { ruta: '/', etiqueta: 'Dashboard', icono: 'dashboard' },
  { ruta: '/cuentas', etiqueta: 'Cuentas', icono: 'cuentas', conBadgeCuentas: true },
  { ruta: '/reportes', etiqueta: 'Reportes', icono: 'reportes', roles: ['dueño'] },
  { ruta: '/configuracion', etiqueta: 'Configuración', icono: 'configuracion', roles: ['dueño'] },
]

function SoloRoles({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  if (!roles) return <>{children}</>
  return (
    <RequireRole roles={roles} fallback={null}>
      {children}
    </RequireRole>
  )
}

function Badge({ cantidad, className }: { cantidad: number; className: string }) {
  if (cantidad <= 0) return null
  return (
    <span className={className} aria-label={`${cantidad} cuentas vencidas o por vencer`}>
      {cantidad}
    </span>
  )
}

function EstadoCajaSidebar() {
  const { caja } = useCaja()
  return (
    <div className="layout__caja">
      <span className="layout__caja-titulo">Caja</span>
      {caja ? (
        <span className="layout__caja-estado">
          <span className="layout__caja-punto" aria-hidden="true" />
          Abierta desde {formatearHora(new Date(caja.fecha_apertura))}
        </span>
      ) : (
        <span className="layout__caja-estado layout__caja-estado--cerrada">
          <span className="layout__caja-punto" aria-hidden="true" />
          Cerrada
        </span>
      )}
    </div>
  )
}

/** Layout de las pantallas internas: sidebar (desktop) o menú inferior (mobile) + header. */
export function AppLayout() {
  const { datos: cuentasEnAlerta } = useConsulta(contarCuentasEnAlerta)
  const badge = cuentasEnAlerta ?? 0
  // El POS ocupa todo el alto: catálogo y carrito con scroll propio (prototipo Ventas POS)
  const esPos = useMatch('/ventas') !== null

  return (
    <div className={esPos ? 'layout layout--pos' : 'layout'}>
      <aside className="layout__sidebar">
        <div className="layout__marca">
          <div className="layout__logo" aria-hidden="true" />
          <span className="layout__nombre">ShowroomCiro</span>
        </div>

        <nav className="layout__nav" aria-label="Principal">
          <div className="layout__nav-titulo">Operación</div>
          {NAV_DESKTOP.map((item) => (
            <SoloRoles key={item.ruta} roles={item.roles}>
              <NavLink to={item.ruta} end={item.ruta === '/'} className="layout__nav-item">
                <span className="layout__nav-punto" aria-hidden="true" />
                <span className="layout__nav-etiqueta">{item.etiqueta}</span>
                {item.conBadgeCuentas && <Badge cantidad={badge} className="layout__badge" />}
              </NavLink>
            </SoloRoles>
          ))}
        </nav>

        <EstadoCajaSidebar />
      </aside>

      <div className="layout__principal">
        <header className="layout__header">
          <div className="layout__header-titulos">
            <div className="layout__logo layout__logo--mobile" aria-hidden="true" />
            <span className="layout__header-nombre">ShowroomCiro</span>
            <span className="layout__header-fecha">{esPos ? 'Punto de venta' : formatearFechaLarga(new Date())}</span>
          </div>
          <MenuUsuario />
        </header>

        <main className="layout__contenido">
          <Outlet />
        </main>
      </div>

      <nav className="layout__tabs" aria-label="Principal">
        {NAV_MOBILE.map((item) => (
          <SoloRoles key={item.ruta} roles={item.roles}>
            <NavLink to={item.ruta} end={item.ruta === '/'} className="layout__tab">
              <span className="layout__tab-icono">
                <IconoNavegacion nombre={item.icono} />
                {item.conBadgeCuentas && <Badge cantidad={badge} className="layout__tab-badge" />}
              </span>
              <span className="layout__tab-etiqueta">{item.etiqueta}</span>
            </NavLink>
          </SoloRoles>
        ))}
      </nav>
    </div>
  )
}
