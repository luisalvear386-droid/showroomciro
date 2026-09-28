-- ShowroomCiro — Registro de venta atómico
-- Requiere 0001 a 0007 ya aplicadas.
--
-- Motivo: registrar una venta desde el frontend eran varias escrituras separadas (insert en
-- `ventas`, insert de cada `venta_items`, update de `variantes.stock` por ítem). Si alguna
-- fallaba en el medio quedaba una venta sin ítems o sin descontar stock, y el precio y el
-- total los mandaba el cliente. Mismo criterio que `cerrar_caja()` (0003) y
-- `aplicar_ajuste_stock()` (0007): una sola función `security definer`, una transacción.
--
-- Contenido:
--   1. RPC `registrar_venta(p_venta_id, p_caja_id, p_medio_pago, p_items)`.
--   2. `variantes.stock` deja de ser editable por UPDATE directo: solo lo mueven
--      `registrar_venta()` y el trigger de `ajustes_stock`. El resto de las columnas que
--      edita la app (stock_minimo, talle, color) siguen editables.
--   3. Sin INSERT directo en `ventas` / `venta_items`: el único camino para registrar una
--      venta es `registrar_venta()` (si no, se podría insertar una venta con cualquier
--      total y sin descontar stock, salteando todo lo de arriba).
--
-- Uso desde el frontend (Módulo 6, POS):
--   supabase.rpc('registrar_venta', {
--     p_venta_id: crypto.randomUUID(), p_caja_id, p_medio_pago,
--     p_items: [{ variante_id, cantidad }, ...],
--   })

-- ============================================================================
-- 1. RPC registrar_venta
-- ============================================================================
-- Idempotencia (pensada para la cola offline del Módulo 11): `p_venta_id` lo genera el
-- cliente. Si ya existe una venta con ese id, se devuelve esa misma venta sin volver a
-- insertar ni descontar stock. Reintentar la sincronización nunca duplica una venta.
-- El insert usa `on conflict (id) do nothing`: si dos reintentos llegan a la vez, el
-- segundo espera a que el primero confirme y termina devolviendo la venta ya creada.
--
-- Precios: se toman de `productos.precio` en el momento de la venta, no del cliente.
-- `p_items` solo trae variante y cantidad. Si la misma variante viene repetida, se suman
-- las cantidades (el control de stock es sobre el total pedido de esa variante).
--
-- Stock: `stock = stock - cantidad` condicionado a `stock >= cantidad`, en un solo UPDATE
-- por variante (el lock de fila serializa ventas y ajustes concurrentes). Las variantes
-- se actualizan en orden de id para que dos ventas simultáneas no se bloqueen entre sí.
-- Si alguna no alcanza, se lanza una excepción y se revierte toda la venta.
--
-- Caja: `p_caja_id` tiene que ser la caja abierta. Se toma `for share` sobre esa fila:
-- un `cerrar_caja()` simultáneo (que la toma `for update`) espera a que termine la venta,
-- así el monto esperado del cierre nunca se saltea una venta que entró en ese instante.
--
-- Errores (el mensaje está pensado para mostrarse tal cual en el POS):
--   42501  usuario no autenticado o inactivo
--   22023  parámetros inválidos (medio de pago, ítems, cantidades) o caja no abierta
--   P0002  una variante no existe
--   23514  sin stock suficiente ("Sin stock suficiente de X")

create or replace function public.registrar_venta(
  p_venta_id   uuid,
  p_caja_id    uuid,
  p_medio_pago text,
  p_items      jsonb
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_venta      public.ventas;
  v_total      numeric(10, 2);
  v_item       record;
begin
  if v_usuario_id is null or public.rol_actual() is null then
    raise exception 'Usuario no autenticado o inactivo'
      using errcode = '42501';
  end if;

  if p_venta_id is null then
    raise exception 'Falta el id de la venta'
      using errcode = '22023';
  end if;

  -- Reintento de una venta que ya se registró: se devuelve tal cual, sin validar de nuevo
  -- (la caja puede haberse cerrado o el stock haber cambiado desde entonces).
  select v.* into v_venta from public.ventas v where v.id = p_venta_id;
  if found then
    if v_venta.usuario_id <> v_usuario_id then
      raise exception 'La venta % pertenece a otro usuario', p_venta_id
        using errcode = '42501';
    end if;
    return v_venta;
  end if;

  if p_medio_pago is null or p_medio_pago not in ('efectivo', 'transferencia', 'tarjeta') then
    raise exception 'Medio de pago inválido: %', coalesce(p_medio_pago, 'vacío')
      using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ítems'
      using errcode = '22023';
  end if;

  perform 1
  from public.cajas c
  where c.id = p_caja_id
    and c.fecha_cierre is null
  for share;

  if not found then
    raise exception 'La caja ya está cerrada. Abrí una caja nueva para seguir vendiendo.'
      using errcode = '22023';
  end if;

  -- Ítems pedidos, agrupados por variante. Se valida la forma antes de tocar nada.
  create temporary table tmp_items_venta (
    variante_id uuid primary key,
    cantidad    integer not null
  ) on commit drop;

  begin
    insert into tmp_items_venta (variante_id, cantidad)
    select (i ->> 'variante_id')::uuid, sum((i ->> 'cantidad')::integer)
    from jsonb_array_elements(p_items) as i
    group by (i ->> 'variante_id')::uuid;
  exception
    when invalid_text_representation or numeric_value_out_of_range or not_null_violation then
      raise exception 'Hay ítems con una variante o cantidad inválida'
        using errcode = '22023';
  end;

  if exists (select 1 from tmp_items_venta where cantidad is null or cantidad <= 0) then
    raise exception 'Las cantidades tienen que ser mayores a 0'
      using errcode = '22023';
  end if;

  select t.variante_id into v_item
  from tmp_items_venta t
  where not exists (select 1 from public.variantes va where va.id = t.variante_id)
  limit 1;

  if found then
    raise exception 'La variante % no existe', v_item.variante_id
      using errcode = 'P0002';
  end if;

  -- Total con el precio actual de cada producto
  select sum(p.precio * t.cantidad)
  into v_total
  from tmp_items_venta t
  join public.variantes va on va.id = t.variante_id
  join public.productos p on p.id = va.producto_id;

  insert into public.ventas (id, usuario_id, caja_id, total, medio_pago, estado_sync)
  values (p_venta_id, v_usuario_id, p_caja_id, v_total, p_medio_pago, 'sincronizada')
  on conflict (id) do nothing
  returning * into v_venta;

  -- Otra llamada con el mismo id la insertó mientras tanto (reintento simultáneo)
  if not found then
    select v.* into v_venta from public.ventas v where v.id = p_venta_id;
    if v_venta.usuario_id <> v_usuario_id then
      raise exception 'La venta % pertenece a otro usuario', p_venta_id
        using errcode = '42501';
    end if;
    return v_venta;
  end if;

  for v_item in
    select t.variante_id, t.cantidad, p.nombre, p.precio, va.talle, va.color
    from tmp_items_venta t
    join public.variantes va on va.id = t.variante_id
    join public.productos p on p.id = va.producto_id
    order by t.variante_id
  loop
    update public.variantes va
    set stock = va.stock - v_item.cantidad
    where va.id = v_item.variante_id
      and va.stock >= v_item.cantidad;

    if not found then
      raise exception 'Sin stock suficiente de % (Talle % · %): quedan % u.',
        v_item.nombre, v_item.talle, v_item.color,
        (select va.stock from public.variantes va where va.id = v_item.variante_id)
        using errcode = '23514';
    end if;

    insert into public.venta_items (venta_id, variante_id, cantidad, precio_unitario)
    values (p_venta_id, v_item.variante_id, v_item.cantidad, v_item.precio);
  end loop;

  return v_venta;
end;
$$;

revoke execute on function public.registrar_venta(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, uuid, text, jsonb) to authenticated;

-- ============================================================================
-- 2. variantes.stock — sin UPDATE directo
-- ============================================================================
-- Privilegio por columna: se quita el UPDATE de la tabla y se devuelve solo sobre las
-- columnas que la app edita. La policy `variantes_update` (0002) sigue aplicando encima.
-- `stock` solo lo cambian `registrar_venta()` y `aplicar_ajuste_stock()` (security
-- definer, corren como owner y no dependen de este grant). El stock inicial de una
-- variante nueva sigue entrando por INSERT (alta/edición de producto).
-- `sku` y `producto_id` tampoco se editan: el SKU lo genera el trigger al insertar.
revoke update on public.variantes from anon, authenticated;
grant update (talle, color, stock_minimo) on public.variantes to authenticated;

-- ============================================================================
-- 3. ventas / venta_items — sin INSERT directo
-- ============================================================================
-- Reemplaza lo que 0004 preveía para el POS ("usar insert con ignoreDuplicates"): la
-- idempotencia ahora la resuelve `registrar_venta()` con el id generado por el cliente.
drop policy ventas_insert on public.ventas;
revoke insert on public.ventas from anon, authenticated;

drop policy venta_items_insert on public.venta_items;
revoke insert on public.venta_items from anon, authenticated;
