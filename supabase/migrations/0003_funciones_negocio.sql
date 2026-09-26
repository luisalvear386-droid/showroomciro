-- ShowroomCiro — Funciones y vistas de lógica de negocio
-- Basado en docs/design.md (sección 2, "APIs principales") y docs/tasks.md (Módulo 2).
-- Requiere 0001_init_schema.sql y 0002_rls_policies.sql ya aplicadas.
--
-- Contenido:
--   0. Ajustes de schema: se quita `cuentas.estado` y se agrega `ventas.caja_id`.
--   1. Trigger BEFORE INSERT en `variantes` que genera el SKU automáticamente.
--   2. Función RPC `cerrar_caja(p_caja_id, p_monto_contado)`.
--   3. Vista `cuentas_vista` con saldo pendiente y estado calculado al vuelo.
--
-- Zona horaria: Supabase corre en UTC. Todo lo que dependa de "hoy" se calcula con la
-- hora de Argentina para que una cuenta no pase a "vencido" a las 21:00 del día anterior.

-- ============================================================================
-- 0. Ajustes de schema
-- ============================================================================

-- cuentas.estado ya no se guarda: `cuentas_vista` es la única fuente de verdad del estado.
alter table public.cuentas drop constraint if exists chk_cuentas_estado;
alter table public.cuentas drop column if exists estado;

-- Cada venta queda vinculada a la caja que estaba abierta cuando se hizo.
-- NOT NULL sin default: si `ventas` ya tuviera filas cargadas a mano, este ALTER falla
-- (hay que asignarles una caja o borrarlas antes). El seed no carga ventas.
alter table public.ventas
  add column caja_id uuid not null references public.cajas (id);

create index idx_ventas_caja_id on public.ventas (caja_id);

-- ============================================================================
-- 1. Generación automática de SKU en variantes
-- ============================================================================
-- Formato: <prefijo-producto>-<color abreviado>-<talle>-<correlativo 4 dígitos>
-- Ejemplo: "Remera Oversize Básica", Azul, M  ->  REM-OVE-AZ-M-0001
--
-- - Prefijo de producto: primeras 3 letras de las dos primeras palabras significativas
--   del nombre (se ignoran palabras de 1-2 letras como "de", "la"). Si el nombre tiene
--   una sola palabra, el prefijo es un único bloque de 3 letras.
-- - Color abreviado: primera letra + primera consonante siguiente (Azul -> AZ,
--   Negro -> NG, Rojo -> RJ, Blanco -> BL), igual que los SKUs del seed.
-- - Talle: en mayúsculas, solo caracteres alfanuméricos (M, XL, 38).
-- - Correlativo: siguiente número libre entre los SKUs que comparten el mismo prefijo
--   de producto. Así dos productos con el mismo prefijo (ej. "Remera Oversize Básica" y
--   "Remera Oversize Estampada") comparten la numeración y no colisionan.
--
-- Solo actúa si `sku` viene null o vacío; si la app manda un SKU explícito, se respeta.

create or replace function public.normalizar_texto_sku(p_texto text)
returns text
language sql
immutable
as $$
  -- Mayúsculas, sin tildes/diéresis/ñ y solo letras, números y espacios.
  select regexp_replace(
    translate(
      upper(coalesce(p_texto, '')),
      'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ',
      'AEIOUAEIOUAEIOUAEIOUNC'
    ),
    '[^A-Z0-9 ]', '', 'g'
  );
$$;

create or replace function public.generar_sku_variante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_producto text;
  v_palabras        text[];
  v_prefijo         text;
  v_color           text;
  v_color_abrev     text;
  v_talle           text;
  v_correlativo     integer;
  v_sku             text;
begin
  if new.sku is not null and btrim(new.sku) <> '' then
    return new;
  end if;

  select nombre
  into v_nombre_producto
  from public.productos
  where id = new.producto_id;

  if v_nombre_producto is null then
    raise exception 'No se puede generar el SKU: el producto % no existe', new.producto_id;
  end if;

  -- Prefijo de producto
  v_palabras := array(
    select palabra
    from unnest(regexp_split_to_array(btrim(public.normalizar_texto_sku(v_nombre_producto)), '\s+')) as palabra
    where length(palabra) >= 3
  );

  if coalesce(array_length(v_palabras, 1), 0) = 0 then
    -- Nombre compuesto solo por palabras cortas: se usa lo que haya.
    v_palabras := regexp_split_to_array(btrim(public.normalizar_texto_sku(v_nombre_producto)), '\s+');
  end if;

  v_prefijo := left(v_palabras[1], 3);
  if array_length(v_palabras, 1) >= 2 then
    v_prefijo := v_prefijo || '-' || left(v_palabras[2], 3);
  end if;

  if v_prefijo is null or v_prefijo = '' then
    v_prefijo := 'PRD';
  end if;

  -- Color abreviado: primera letra + primera consonante posterior
  v_color := replace(public.normalizar_texto_sku(new.color), ' ', '');
  v_color_abrev := left(v_color, 1)
    || coalesce(substring(substr(v_color, 2) from '[B-DF-HJ-NP-TV-Z]'), substr(v_color, 2, 1), 'X');
  if v_color = '' then
    v_color_abrev := 'XX';
  end if;

  -- Talle
  v_talle := replace(public.normalizar_texto_sku(new.talle), ' ', '');
  if v_talle = '' then
    v_talle := 'U';
  end if;

  -- Serializa la generación por prefijo para que dos inserts concurrentes del mismo
  -- producto no calculen el mismo correlativo. El lock se libera al terminar la transacción.
  perform pg_advisory_xact_lock(hashtext('sku:' || v_prefijo));

  -- Siguiente correlativo libre para este prefijo (toma los últimos 4 dígitos del SKU).
  select coalesce(max(substring(sku from '-(\d{4})$')::integer), 0) + 1
  into v_correlativo
  from public.variantes
  where sku like v_prefijo || '-%';

  -- Por si existe un SKU cargado a mano que coincida, se avanza hasta uno libre.
  loop
    v_sku := v_prefijo || '-' || v_color_abrev || '-' || v_talle || '-' || lpad(v_correlativo::text, 4, '0');
    exit when not exists (select 1 from public.variantes where sku = v_sku);
    v_correlativo := v_correlativo + 1;
  end loop;

  new.sku := v_sku;
  return new;
end;
$$;

create trigger trg_variantes_generar_sku
  before insert on public.variantes
  for each row
  execute function public.generar_sku_variante();

-- ============================================================================
-- 2. RPC cerrar_caja
-- ============================================================================
-- Uso desde el frontend: supabase.rpc('cerrar_caja', { p_caja_id, p_monto_contado })
-- Devuelve la fila de `cajas` ya cerrada (con monto_esperado y diferencia) para que la
-- pantalla "Caja — Cierre" pueda mostrar el resultado antes del logout automático.
--
-- monto_esperado = monto_inicial + suma de ventas.total en efectivo de esta caja
--                  (ventas.caja_id = p_caja_id). Tarjeta y transferencia no entran porque
--                  no son efectivo físico en el cajón.
-- diferencia     = monto_contado - monto_esperado (negativo = falta plata).
--
-- security definer: permite sumar ventas sin depender de lo que el rol del usuario pueda
-- leer. Por eso valida explícitamente que quien llama sea un usuario activo de la app.

create or replace function public.cerrar_caja(p_caja_id uuid, p_monto_contado numeric)
returns public.cajas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id     uuid := auth.uid();
  v_caja           public.cajas;
  v_ahora          timestamptz := now();
  v_total_ventas   numeric(10, 2);
  v_monto_esperado numeric(10, 2);
begin
  if v_usuario_id is null or public.rol_actual() is null then
    raise exception 'Usuario no autenticado o inactivo'
      using errcode = '42501';
  end if;

  if p_monto_contado is null or p_monto_contado < 0 then
    raise exception 'El monto contado debe ser un número mayor o igual a 0'
      using errcode = '22023';
  end if;

  -- Bloquea la fila para evitar dos cierres simultáneos de la misma caja.
  select *
  into v_caja
  from public.cajas
  where id = p_caja_id
  for update;

  if not found then
    raise exception 'La caja % no existe', p_caja_id
      using errcode = 'P0002';
  end if;

  if v_caja.fecha_cierre is not null then
    raise exception 'La caja ya fue cerrada el %', v_caja.fecha_cierre
      using errcode = '22023';
  end if;

  select coalesce(sum(v.total), 0)
  into v_total_ventas
  from public.ventas v
  where v.caja_id = p_caja_id
    and v.medio_pago = 'efectivo';

  v_monto_esperado := v_caja.monto_inicial + v_total_ventas;

  update public.cajas
  set monto_esperado    = v_monto_esperado,
      monto_contado     = p_monto_contado,
      diferencia        = p_monto_contado - v_monto_esperado,
      fecha_cierre      = v_ahora,
      usuario_cierre_id = v_usuario_id
  where id = p_caja_id
  returning * into v_caja;

  return v_caja;
end;
$$;

revoke execute on function public.cerrar_caja(uuid, numeric) from public, anon;
grant execute on function public.cerrar_caja(uuid, numeric) to authenticated;

-- ============================================================================
-- 3. Vista cuentas_vista
-- ============================================================================
-- Expone todas las columnas de `cuentas` más:
--   - saldo_pendiente: monto_total - suma de cuenta_pagos.
--   - estado: calculado al vuelo ('pagado' / 'vencido' / 'por_vencer' / 'al_dia').
--
-- `cuentas` ya no tiene columna `estado` (ver sección 0): esta vista es la única fuente
-- de verdad del estado de una cuenta.
--
-- security_invoker: la vista respeta el RLS de `cuentas` y `cuenta_pagos` del usuario
-- que consulta (sin esto correría con los permisos del dueño de la vista y saltearía RLS).

create or replace view public.cuentas_vista
with (security_invoker = true)
as
with hoy as (
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as fecha
),
pagos as (
  select cuenta_id, sum(monto) as total_pagado
  from public.cuenta_pagos
  group by cuenta_id
),
base as (
  select
    c.id,
    c.cliente_nombre,
    c.cliente_telefono,
    c.monto_total,
    c.fecha_limite,
    c.created_at,
    (c.monto_total - coalesce(p.total_pagado, 0))::numeric(10, 2) as saldo_pendiente
  from public.cuentas c
  left join pagos p on p.cuenta_id = c.id
)
select
  b.id,
  b.cliente_nombre,
  b.cliente_telefono,
  b.monto_total,
  b.fecha_limite,
  case
    when b.saldo_pendiente <= 0            then 'pagado'
    when b.fecha_limite < h.fecha          then 'vencido'
    when b.fecha_limite - h.fecha <= 3     then 'por_vencer'
    else 'al_dia'
  end as estado,
  b.created_at,
  b.saldo_pendiente
from base b
cross join hoy h;

comment on view public.cuentas_vista is
  'Cuentas con saldo_pendiente y estado (al_dia/por_vencer/vencido/pagado) calculados al vuelo.';

grant select on public.cuentas_vista to authenticated;
