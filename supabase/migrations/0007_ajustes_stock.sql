-- ShowroomCiro — Ajuste de stock atómico
-- Requiere 0001 a 0006 ya aplicadas.
--
-- Motivo: hasta ahora insertar en `ajustes_stock` solo dejaba el registro; `variantes.stock`
-- no se movía. Resolverlo desde el frontend (insert del ajuste + update del stock) son dos
-- requests: si el segundo falla queda un ajuste sin efecto, y dos ajustes simultáneos sobre
-- la misma variante pueden pisarse si el frontend calcula el stock nuevo a partir del que leyó.
--
-- Contenido:
--   1. `usuario_id` toma `auth.uid()` por default y la policy de INSERT exige que sea el
--      propio usuario (nadie registra un ajuste a nombre de otro).
--   2. `motivo` obligatorio (no null, no vacío).
--   3. Sin UPDATE sobre `ajustes_stock` para nadie: es un registro de auditoría, y editar
--      `cantidad`/`tipo` de un ajuste ya aplicado dejaría el stock desincronizado.
--   4. Trigger AFTER INSERT que aplica el ajuste sobre `variantes.stock` en la misma
--      transacción. Si es una resta mayor al stock actual, el insert falla entero.
--
-- Uso desde el frontend (Módulo 5, modal "Ajuste de stock"):
--   supabase.from('ajustes_stock').insert({ variante_id, tipo, cantidad, motivo })
-- El stock resultante se lee después de `variantes`.

-- ============================================================================
-- 1. usuario_id = quien hace el ajuste
-- ============================================================================
alter table public.ajustes_stock
  alter column usuario_id set default auth.uid();

drop policy ajustes_stock_insert on public.ajustes_stock;
create policy ajustes_stock_insert on public.ajustes_stock
  for insert
  with check (
    public.rol_actual() is not null
    and usuario_id = auth.uid()
  );

-- ============================================================================
-- 2. Motivo obligatorio
-- ============================================================================
-- Si hubiera ajustes viejos sin motivo, este ALTER falla: completarlos antes.
alter table public.ajustes_stock
  alter column motivo set not null;

alter table public.ajustes_stock
  add constraint chk_ajustes_stock_motivo_no_vacio check (btrim(motivo) <> '');

-- ============================================================================
-- 3. Sin UPDATE
-- ============================================================================
drop policy ajustes_stock_update on public.ajustes_stock;
revoke update on public.ajustes_stock from anon, authenticated;

-- ============================================================================
-- 4. Trigger: aplica el ajuste sobre variantes.stock
-- ============================================================================
-- `stock = stock ± cantidad` en un solo UPDATE: el lock de fila serializa ajustes
-- concurrentes sobre la misma variante, sin leer-y-escribir desde el cliente.
--
-- security definer: el ajuste tiene que aplicarse aunque más adelante se restrinja el
-- UPDATE directo de `variantes.stock` (quien pasa por acá ya pasó la policy de INSERT).
create or replace function public.aplicar_ajuste_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer := case when new.tipo = 'suma' then new.cantidad else -new.cantidad end;
begin
  update public.variantes v
  set stock = v.stock + v_delta
  where v.id = new.variante_id
    and v.stock + v_delta >= 0;

  if not found then
    if exists (select 1 from public.variantes where id = new.variante_id) then
      raise exception 'No se puede restar % u.: el stock actual es menor', new.cantidad
        using errcode = '23514';
    end if;
    raise exception 'La variante % no existe', new.variante_id
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

create trigger trg_ajustes_stock_aplicar
  after insert on public.ajustes_stock
  for each row
  execute function public.aplicar_ajuste_stock();
