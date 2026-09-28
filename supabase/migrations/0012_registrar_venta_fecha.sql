-- ShowroomCiro — Fecha real de la venta en `registrar_venta()` (Módulo 11, offline-first)
-- Requiere 0001 a 0011 ya aplicadas.
--
-- Motivo: una venta hecha sin conexión queda en la cola local del POS y llega al servidor
-- recién al reconectar. `registrar_venta()` (0008) guardaba `fecha = now()`, o sea la hora
-- de la sincronización: la venta caía en otro horario (o en otro día) en los reportes.
--
-- Contenido:
--   1. `registrar_venta()` suma `p_fecha timestamptz default null`: la hora en que se hizo
--      la venta en el mostrador. Sin `p_fecha` se comporta igual que antes (fecha = now()),
--      así que el POS online actual sigue funcionando sin cambios.
--
-- `ventas.created_at` (default now(), 0001) sigue marcando cuándo llegó la venta al
-- servidor: una venta sincronizada tarde se reconoce por `created_at` > `fecha`.
--
-- La firma cambia (5 parámetros), así que se borra la función de 0008 y se crea de nuevo
-- con los mismos grants. PostgREST resuelve la llamada con 4 parámetros nombrados contra
-- esta función gracias al default de `p_fecha`.

begin;

drop function public.registrar_venta(uuid, uuid, text, jsonb);

-- ============================================================================
-- 1. RPC registrar_venta
-- ============================================================================
-- Todo lo documentado en 0008 sigue valiendo (idempotencia por `p_venta_id`, precios de
-- la base, stock condicionado a `stock >= cantidad`, caja abierta tomada `for share`,
-- mismos códigos de error). Cambia solo la fecha:
--
-- `p_fecha`: la manda el cliente, así que se acota en vez de rechazarla. Una venta real
-- no debe quedar trabada en la cola por el reloj de la PC:
--   - nunca antes de la apertura de la caja (un reloj atrasado no la saca de su jornada);
--   - nunca después de now() (un reloj adelantado no la manda al futuro).
--
-- Productos dados de baja: a propósito NO se valida `productos.activo`. Una venta offline
-- hecha con el catálogo cacheado puede llegar después de que alguien dio de baja el
-- producto desde otra sesión; la prenda ya salió del local, así que se registra igual.

create function public.registrar_venta(
  p_venta_id   uuid,
  p_caja_id    uuid,
  p_medio_pago text,
  p_items      jsonb,
  p_fecha      timestamptz default null
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id     uuid := auth.uid();
  v_venta          public.ventas;
  v_total          numeric(10, 2);
  v_item           record;
  v_fecha_apertura timestamptz;
  v_fecha          timestamptz;
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

  select c.fecha_apertura
  into v_fecha_apertura
  from public.cajas c
  where c.id = p_caja_id
    and c.fecha_cierre is null
  for share;

  if not found then
    raise exception 'La caja ya está cerrada. Abrí una caja nueva para seguir vendiendo.'
      using errcode = '22023';
  end if;

  v_fecha := least(greatest(coalesce(p_fecha, now()), v_fecha_apertura), now());

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

  insert into public.ventas (id, usuario_id, caja_id, fecha, total, medio_pago, estado_sync)
  values (p_venta_id, v_usuario_id, p_caja_id, v_fecha, v_total, p_medio_pago, 'sincronizada')
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

revoke execute on function public.registrar_venta(uuid, uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.registrar_venta(uuid, uuid, text, jsonb, timestamptz) to authenticated;

commit;

-- PostgREST: que vea la firma nueva sin esperar la recarga automática del esquema
notify pgrst, 'reload schema';
