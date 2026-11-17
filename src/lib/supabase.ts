import { createClient } from '@supabase/supabase-js'
import { fetchConAviso } from './conexion'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en el archivo .env (ver .env.example).',
  )
}

/**
 * Clave con la que supabase-js guarda la sesión en localStorage (su default, porque no se
 * le pasa `storageKey`). La usan `haySesionGuardada()` y `borrarSesionGuardada()` (lib/auth.ts).
 */
export const CLAVE_SESION = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Avisa las fallas de red: con ellas la app pasa a "Sin conexión" (lib/conexion.ts)
  global: { fetch: fetchConAviso },
})
