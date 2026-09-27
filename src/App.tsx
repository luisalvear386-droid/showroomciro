import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/auth-provider'
import { RequireAuth } from './auth/require-auth'
import { RequireRole } from './auth/require-role'
import { CajaProvider } from './caja/caja-provider'
import { RequireCajaAbierta } from './caja/require-caja-abierta'
import { AppLayout } from './components/app-layout'
import { AperturaCajaPage } from './pages/apertura-caja-page'
import { DashboardPage } from './pages/dashboard-page'
import { EnConstruccionPage } from './pages/en-construccion-page'
import { LoginPage } from './pages/login-page'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Todo lo demás requiere sesión activa */}
          <Route element={<RequireAuth />}>
            <Route element={<CajaProvider />}>
              {/* Paso bloqueante post-login: se saltea solo si ya hay una caja abierta */}
              <Route path="apertura-caja" element={<AperturaCajaPage />} />

              <Route element={<RequireCajaAbierta />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  {/* Destinos de "Nueva Venta" / "Nueva Cuenta" del Dashboard (sin ítem de menú) */}
                  <Route path="ventas" element={<EnConstruccionPage titulo="Nueva Venta" modulo={6} />} />
                  <Route path="cuentas/nueva" element={<EnConstruccionPage titulo="Nueva Cuenta" modulo={7} />} />
                  <Route path="productos" element={<EnConstruccionPage titulo="Productos" modulo={5} />} />
                  <Route path="caja" element={<EnConstruccionPage titulo="Caja" modulo={8} />} />
                  <Route path="cuentas" element={<EnConstruccionPage titulo="Cuentas" modulo={7} />} />

                  <Route element={<RequireRole roles={['dueño']} />}>
                    <Route path="reportes" element={<EnConstruccionPage titulo="Reportes" modulo={9} />} />
                    <Route path="usuarios" element={<EnConstruccionPage titulo="Usuarios" modulo={9} />} />
                    <Route
                      path="configuracion"
                      element={<EnConstruccionPage titulo="Configuración" modulo={10} />}
                    />
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
