import { useOutletContext } from 'react-router'

/** Lo que `AppLayout` le pasa a las pantallas internas por `<Outlet context>`. */
export interface ContextoLayout {
  /** Vuelve a contar las cuentas vencidas/por vencer del badge del menú. */
  refrescarAlertasCuentas: () => void
}

/** Para llamar después de un alta o un cobro, que pueden cambiar el badge de "Cuentas". */
export function useRefrescarAlertasCuentas(): () => void {
  return useOutletContext<ContextoLayout>().refrescarAlertasCuentas
}
