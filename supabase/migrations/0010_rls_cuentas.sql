-- ShowroomCiro — Endurecimiento de cuentas / cuenta_pagos
-- Requiere 0001 a 0009 ya aplicadas.
--
-- Motivo: después de 0009 quedaban dos formas de alterar una deuda salteando
-- `registrar_pago()`:
--   - `cuenta_pagos_update` (0002) permitía editar el monto de un pago ya registrado
--     (ej. subirlo por encima del saldo, o bajarlo para "revivir" deuda cobrada).
--   - `cuentas_update` (0002) permitía bajar `monto_total` por debajo de lo ya pagado:
--     la cuenta quedaba "pagado" con saldo negativo, o se perdonaba deuda sin que
--     ningún pago lo reflejara.
--
-- Contenido:
--   1. Sin UPDATE directo sobre `cuenta_pagos` (mismo criterio que `ventas` en 0004/0008).
--   2. Trigger BEFORE UPDATE en `cuentas` que impide dejar `monto_total` por debajo de la
--      suma de sus pagos. Si la cuenta no tiene pagos, se puede corregir el monto libremente.

-- ============================================================================
-- 1. cuenta_pagos — sin UPDATE directo
-- ============================================================================
-- Un pago es un registro financiero: no se edita ni se borra vía API (tampoco hay
-- policy de DELETE desde 0002). El único camino para registrar un cobro es
-- `registrar_pago()` (0009).
drop policy cuenta_pagos_update on public.cuenta_pagos;
revoke update on public.cuenta_pagos from anon, authenticated;

-- ============================================================================
-- 2. cuentas — monto_total nunca por debajo de lo pagado
-- ============================================================================
-- Solo actúa cuando cambia `monto_total`: editar nombre, teléfono o fecha límite de una
-- cuenta con pagos sigue funcionando igual.
--
-- Concurrencia: el UPDATE ya tiene tomada la fila de la cuenta cuando corre el trigger, y
-- `registrar_pago()` toma esa misma fila `for update` antes de insertar. Un cobro y una
-- corrección de monto simultáneos sobre la misma cuenta se serializan, así que la suma
-- que ve el trigger siempre incluye el pago que haya entrado antes.
--
-- security definer: la suma no depende del RLS de `cuenta_pagos` del que edita.
--
-- Error (el mensaje está pensado para mostrarse tal cual):
--   23514  el monto nuevo queda por debajo de lo ya cobrado

create or replace function public.validar_monto_total_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_pagado numeric(10, 2);
begin
  select coalesce(sum(cp.monto), 0)
  into v_total_pagado
  from public.cuenta_pagos cp
  where cp.cuenta_id = new.id;

  if new.monto_total < v_total_pagado then
    raise exception 'El monto no puede ser menor a lo ya cobrado ($ %)',
      translate(
        to_char(
          v_total_pagado,
          case when v_total_pagado = trunc(v_total_pagado) then 'FM999,999,990' else 'FM999,999,990.00' end
        ),
        ',.', '.,'
      )
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_monto_total_cuenta() from public, anon, authenticated;

create trigger trg_cuentas_validar_monto_total
  before update of monto_total on public.cuentas
  for each row
  when (new.monto_total is distinct from old.monto_total)
  execute function public.validar_monto_total_cuenta();
