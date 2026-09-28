-- ShowroomCiro — Registro de cobro de cuenta atómico
-- Requiere 0001 a 0008 ya aplicadas.
--
-- Motivo: con INSERT directo sobre `cuenta_pagos` nada impedía cobrar más que el saldo
-- pendiente, y dos cobros simultáneos sobre la misma cuenta podían pasar ambos la
-- validación del frontend (cada uno veía el saldo anterior al otro). Mismo criterio que
-- `cerrar_caja()` (0003), `aplicar_ajuste_stock()` (0007) y `registrar_venta()` (0008):
-- una sola función `security definer`, una transacción.
--
-- Contenido:
--   1. RPC `registrar_pago(p_cuenta_id, p_monto)`.
--   2. Sin INSERT directo en `cuenta_pagos`: el único camino para registrar un cobro es
--      `registrar_pago()`.
--
-- Uso desde el frontend (Módulo 7, Cuentas — Detalle/Cobro):
--   supabase.rpc('registrar_pago', { p_cuenta_id, p_monto })
--   → devuelve la fila de `cuentas_vista` de esa cuenta ya con el pago aplicado.

-- ============================================================================
-- 1. RPC registrar_pago
-- ============================================================================
-- Concurrencia: se toma la fila de `cuentas` `for update` antes de calcular el saldo.
-- Un segundo cobro sobre la misma cuenta espera a que el primero confirme y recién ahí
-- calcula el saldo, ya con el primer pago sumado. Cobros sobre cuentas distintas no se
-- bloquean entre sí.
--
-- El monto se redondea a 2 decimales (la precisión de `cuenta_pagos.monto`) antes de
-- validarlo, así lo que se compara contra el saldo es exactamente lo que se guarda.
--
-- Errores (el mensaje está pensado para mostrarse tal cual en la pantalla de cobro):
--   42501  usuario no autenticado o inactivo
--   22023  monto inválido (vacío o <= 0)
--   P0002  la cuenta no existe
--   23514  la cuenta ya está saldada, o el monto supera el saldo pendiente

create or replace function public.registrar_pago(
  p_cuenta_id uuid,
  p_monto     numeric
)
returns public.cuentas_vista
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monto        numeric(10, 2);
  v_monto_total  numeric(10, 2);
  v_total_pagado numeric(10, 2);
  v_saldo        numeric(10, 2);
  v_cuenta       public.cuentas_vista;
begin
  if auth.uid() is null or public.rol_actual() is null then
    raise exception 'Usuario no autenticado o inactivo'
      using errcode = '42501';
  end if;

  v_monto := round(p_monto, 2);

  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto del cobro tiene que ser mayor a 0'
      using errcode = '22023';
  end if;

  select c.monto_total
  into v_monto_total
  from public.cuentas c
  where c.id = p_cuenta_id
  for update;

  if not found then
    raise exception 'La cuenta no existe'
      using errcode = 'P0002';
  end if;

  select coalesce(sum(cp.monto), 0)
  into v_total_pagado
  from public.cuenta_pagos cp
  where cp.cuenta_id = p_cuenta_id;

  v_saldo := v_monto_total - v_total_pagado;

  if v_saldo <= 0 then
    raise exception 'La cuenta ya está saldada'
      using errcode = '23514';
  end if;

  -- Formato argentino ($ 18.500 / $ 1.250,50). Se arma con separadores literales para
  -- no depender del lc_numeric del servidor.
  if v_monto > v_saldo then
    raise exception 'El monto supera el saldo adeudado ($ %)',
      translate(
        to_char(v_saldo, case when v_saldo = trunc(v_saldo) then 'FM999,999,990' else 'FM999,999,990.00' end),
        ',.', '.,'
      )
      using errcode = '23514';
  end if;

  insert into public.cuenta_pagos (cuenta_id, monto)
  values (p_cuenta_id, v_monto);

  select cv.* into v_cuenta from public.cuentas_vista cv where cv.id = p_cuenta_id;
  return v_cuenta;
end;
$$;

revoke execute on function public.registrar_pago(uuid, numeric) from public, anon;
grant execute on function public.registrar_pago(uuid, numeric) to authenticated;

-- ============================================================================
-- 2. cuenta_pagos — sin INSERT directo
-- ============================================================================
-- Si no, se podría insertar un pago por cualquier monto (incluso mayor al saldo),
-- salteando todo lo de arriba.
drop policy cuenta_pagos_insert on public.cuenta_pagos;
revoke insert on public.cuenta_pagos from anon, authenticated;
