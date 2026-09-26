import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/auth-provider'
import { RequireAuth } from './auth/require-auth'
import { LoginPage } from './pages/login-page'
import { SesionPage } from './pages/sesion-page'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Todo lo demás requiere sesión activa */}
          <Route element={<RequireAuth />}>
            <Route index element={<SesionPage />} />
            {/* Rutas solo Dueño/a (Módulos siguientes), ej.:
                <Route element={<RequireRole roles={['dueño']} />}>
                  <Route path="reportes" element={<ReportesPage />} />
                </Route> */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
