import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/auth-provider'
import { RequireAuth } from './auth/require-auth'
import { RequireRole } from './auth/require-role'
import { CajaProvider } from './caja/caja-provider'
import { RequireCajaAbierta } from './caja/require-caja-abierta'
import { AppLayout } from './components/app-layout'
import { SoloEscritorio } from './components/solo-escritorio'
import { AperturaCajaPage } from './pages/apertura-caja-page'
import { CajaCierrePage } from './pages/caja-cierre-page'
import { CajaHistorialPage } from './pages/caja-historial-page'
import { ConfiguracionPage } from './pages/configuracion-page'
import { CuentaNuevaPage } from './pages/cuenta-nueva-page'
import { CuentasPage } from './pages/cuentas-page'
import { DashboardPage } from './pages/dashboard-page'
import { LoginPage } from './pages/login-page'
import { ProductoFormPage } from './pages/producto-form-page'
import { ProductosPage } from './pages/productos-page'
import { ReportesPage } from './pages/reportes-page'
import { UsuariosPage } from './pages/usuarios-page'
import { VentasPage } from './pages/ventas-page'
import { SincronizacionProvider } from './sincronizacion/sincronizacion-provider'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Todo lo demás requiere sesión activa */}
          <Route element={<RequireAuth />}>
            {/* Cola de ventas offline del mostrador (Módulo 11): se sincroniza sola */}
            <Route element={<SincronizacionProvider />}>
              <Route element={<CajaProvider />}>
                {/* Paso bloqueante post-login: se saltea solo si ya hay una caja abierta */}
                <Route path="apertura-caja" element={<AperturaCajaPage />} />

                {/* Consulta y gestión, no venta: la apertura obligatoria bloquea la venta, no esto */}
                <Route element={<RequireRole roles={['dueño']} />}>
                  <Route element={<AppLayout />}>
                    <Route path="caja/historial" element={<CajaHistorialPage />} />
                    <Route path="reportes" element={<ReportesPage />} />
                    <Route path="usuarios" element={<UsuariosPage />} />
                    {/* Menú "Configuración" del celular: por ahora solo lleva a Gestión de Usuarios */}
                    <Route path="configuracion" element={<ConfiguracionPage />} />
                  </Route>
                </Route>

                <Route element={<RequireCajaAbierta />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="cuentas" element={<CuentasPage />} />
                    {/* Detalle/Cobro: modal sobre la agenda (en mobile, sin cobro) */}
                    <Route path="cuentas/:id" element={<CuentasPage />} />

                    {/* Venta, caja y altas/ediciones: solo desde el mostrador, nunca desde el celular */}
                    <Route element={<SoloEscritorio />}>
                      {/* Destinos de "Nueva Venta" / "Nueva Cuenta" del Dashboard (sin ítem de menú) */}
                      <Route path="ventas" element={<VentasPage />} />
                      <Route path="cuentas/nueva" element={<CuentaNuevaPage />} />
                      <Route path="productos" element={<ProductosPage />} />
                      <Route path="productos/nuevo" element={<ProductoFormPage />} />
                      <Route path="productos/:id/editar" element={<ProductoFormPage />} />
                      <Route path="caja" element={<CajaCierrePage />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
