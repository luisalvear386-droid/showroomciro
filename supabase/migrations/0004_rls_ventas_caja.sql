-- ShowroomCiro — Endurecimiento de RLS sobre `ventas`, `venta_items` y `cajas`
-- Requiere 0001, 0002 y 0003 ya aplicadas.
--
-- Motivo: con las policies de 0002 el Vendedor podía leer TODAS las filas de `ventas` y
-- `venta_items` (cualquier fecha/caja/usuario) pegándole directo a la tabla vía PostgREST,
-- y así reconstruir los reportes que las vistas `reportes_*` le ocultan. Además podía
-- editar ventas ya hechas, editar/cerrar cajas a mano sin pasar por `cerrar_caja()` e
-- insertar cajas "ya cerradas" o a nombre de otro usuario.
--
-- Contenido:
--   1. Helper `caja_abierta_id()`.
--   2. `ventas_select` / `venta_items_select`: Vendedor ve solo sus ventas de la caja abierta.
--   3. `ventas_update` / `venta_items_update`: se eliminan (nadie edita ventas vía API).
--   4. `cajas_select`: Vendedor ve solo las cajas que abrió o cerró.
--   5. `cajas_update`: se elimina (el único camino para cerrar es `cerrar_caja()`).
--   5b. `cajas_insert`: solo se abre a nombre propio y sin datos de cierre
--       (`usuario_apertura_id` toma `auth.uid()` por default).
--   6. Índice único parcial: como máximo una caja abierta a la vez.
--   7. RPC `caja_actual_resumen()` para el KPI "ventas de hoy" del Dashboard.
--
-- No se tocan `cuentas_vista`, las vistas `reportes_*` ni las funciones de 0003: filtran por
-- `es_dueno()` o son security definer, y el Dueño/a sigue viendo todo.

-- ============================================================================
-- 1. Helper: id de la caja abierta
-- ============================================================================
-- security definer: la policy de `ventas` necesita saber cuál es la caja abierta aunque
-- el Vendedor no pueda leer esa fila de `cajas` (ej. la abrió otro usuario). Solo expone
-- el id, que igual se obtiene con `caja_actual_resumen()`.
-- El índice de la sección 6 garantiza que devuelve como máximo una fila.
create or replace function public.caja_abierta_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select c.id
  from public.cajas c
  where c.fecha_cierre is null;
$$;

revoke execute on function public.caja_abierta_id() from public, anon;
grant execute on function public.caja_abierta_id() to authenticated;

-- ============================================================================
-- 2. ventas / venta_items — lectura
-- ============================================================================
-- Dueño/a: todo el historial. Vendedor: solo las ventas que hizo él en la caja abierta
-- (lo mínimo que puede necesitar el POS, ej. un insert().select() o verificar la cola
-- offline). Los agregados del turno van por `caja_actual_resumen()`.
drop policy ventas_select on public.ventas;
create policy ventas_select on public.ventas
  for select
  using (
    public.es_dueno()
    or (
      public.rol_actual() is not null
      and usuario_id = auth.uid()
      and caja_id = public.caja_abierta_id()
    )
  );

-- Hereda el recorte de `ventas`: la subconsulta se evalúa con el RLS de `ventas` del
-- usuario que consulta, así que el Vendedor solo ve ítems de ventas que puede ver.
drop policy venta_items_select on public.venta_items;
create policy venta_items_select on public.venta_items
  for select
  using (
    public.es_dueno()
    or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)
  );

-- ============================================================================
-- 3. ventas / venta_items — sin UPDATE directo para nadie
-- ============================================================================
-- Una venta es un registro financiero: los cambios/devoluciones se resuelven con nota de
-- crédito, no editando la venta original. Tampoco se le deja UPDATE al Dueño/a: una
-- corrección editando `total`/`medio_pago`/`caja_id` alteraría a posteriori cierres de
-- caja ya conciliados. Si hiciera falta una corrección excepcional, se hace con una
-- función específica que deje rastro, o desde el SQL editor (service role).
-- Consecuencia para el POS/sync offline: usar insert (con ignoreDuplicates si reintenta),
-- nunca upsert con merge.
drop policy ventas_update on public.ventas;
revoke update on public.ventas from anon, authenticated;

-- Mismo criterio para los ítems: editar cantidad/precio_unitario alteraría la venta igual
-- que editar su total.
drop policy venta_items_update on public.venta_items;
revoke update on public.venta_items from anon, authenticated;

-- ============================================================================
-- 4. cajas — lectura
-- ============================================================================
-- Dueño/a: todo el historial. Vendedor: solo las cajas que abrió o cerró (detalle completo,
-- incluidos monto_esperado y diferencia). Para saber si hay una caja abierta, y cuál, usa
-- `caja_actual_resumen()`, aunque la haya abierto otro usuario.
drop policy cajas_select on public.cajas;
create policy cajas_select on public.cajas
  for select
  using (
    public.es_dueno()
    or (
      public.rol_actual() is not null
      and auth.uid() in (usuario_apertura_id, usuario_cierre_id)
    )
  );

-- ============================================================================
-- 5. cajas — sin UPDATE directo para nadie
-- ============================================================================
-- El único camino para cerrar una caja es `cerrar_caja()` (security definer, no necesita
-- esta policy). La apertura es un INSERT y sigue cubierta por `cajas_insert`.
drop policy cajas_update on public.cajas;
revoke update on public.cajas from anon, authenticated;

-- ============================================================================
-- 5b. cajas — apertura
-- ============================================================================
-- Cada uno abre la caja a su nombre, y la caja nace abierta: todos los datos de cierre
-- (incluido monto_esperado) los completa únicamente `cerrar_caja()`.
-- El default evita que cada pantalla tenga que mandar usuario_apertura_id; si lo manda,
-- la policy igual exige que sea el propio usuario.
alter table public.cajas
  alter column usuario_apertura_id set default auth.uid();

drop policy cajas_insert on public.cajas;
create policy cajas_insert on public.cajas
  for insert
  with check (
    public.rol_actual() is not null
    and usuario_apertura_id = auth.uid()
    and fecha_cierre is null
    and usuario_cierre_id is null
    and monto_esperado is null
    and monto_contado is null
    and diferencia is null
  );

-- ============================================================================
-- 6. Como máximo una caja abierta
-- ============================================================================
-- Si ya hubiera dos cajas abiertas cargadas, este índice falla: cerrar una antes.
create unique index uq_cajas_una_abierta
  on public.cajas ((true))
  where fecha_cierre is null;

-- ============================================================================
-- 7. RPC caja_actual_resumen
-- ============================================================================
-- Uso desde el frontend: supabase.rpc('caja_actual_resumen')
-- KPI operativo del turno para el Dashboard (Dueño/a y Vendedor): cantidad de ventas y
-- total vendido (todos los medios de pago) en la caja abierta. Devuelve 0 filas si no hay
-- caja abierta (sirve también para decidir si mostrar la apertura de caja).
--
-- No expone monto_inicial, el total en efectivo ni monto_esperado: el cierre es a conteo
-- ciego, y `cerrar_caja()` recién devuelve monto_esperado después de cerrar.
create or replace function public.caja_actual_resumen()
returns table (
  caja_id         uuid,
  fecha_apertura  timestamptz,
  cantidad_ventas integer,
  total_vendido   numeric(12, 2)
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.rol_actual() is null then
    raise exception 'Usuario no autenticado o inactivo'
      using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.fecha_apertura,
    count(v.id)::integer,
    coalesce(sum(v.total), 0)::numeric(12, 2)
  from public.cajas c
  left join public.ventas v on v.caja_id = c.id
  where c.fecha_cierre is null
  group by c.id, c.fecha_apertura;
end;
$$;

revoke execute on function public.caja_actual_resumen() from public, anon;
grant execute on function public.caja_actual_resumen() to authenticated;
