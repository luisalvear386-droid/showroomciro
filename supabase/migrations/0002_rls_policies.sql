-- ShowroomCiro — Row Level Security
-- Refleja la tabla de permisos de docs/requirements.md sección 2:
--
-- | Acción                                          | Dueño/a | Vendedor |
-- |--------------------------------------------------|---------|----------|
-- | Vender (caja/POS)                                 | sí     | sí       |
-- | Cargar / ajustar stock                            | sí     | sí       |
-- | Ver reportes de ventas y ganancias                | sí     | no       |
-- | Ver costos de productos                           | sí     | no       |
-- | Alta / gestión / baja de productos y categorías   | sí     | sí       |
-- | Abrir/cerrar caja                                 | sí     | sí       |
-- | Gestionar usuarios (altas de vendedores)          | sí     | no       |
-- | Registrar cuentas y cobrar/abonar cuentas          | sí     | sí       |
--
-- Nota sobre "Ver reportes de ventas y ganancias": no existe una tabla `reportes` propia
-- (los reportes son consultas agregadas sobre `ventas`/`venta_items`). El Vendedor
-- necesita leer y escribir `ventas`/`venta_items` para operar el POS y la caja, tal como
-- exige la fila "Vender (caja/POS)"; por lo tanto esa lectura operativa queda permitida.
-- La parte de "ganancias" depende del costo de los productos, que sí queda bloqueada de
-- forma estricta vía RLS en `productos_costos`. La pantalla "Reportes" en sí se restringe
-- además a nivel de frontend/routing (solo Dueño/a la ve).

-- ============================================================================
-- Función auxiliar: rol del usuario autenticado actual
-- ============================================================================
-- security definer: le permite leer `perfiles` sin quedar atrapada en las políticas RLS
-- de esa misma tabla (evita recursión). Solo devuelve rol si el perfil está activo.
create or replace function public.rol_actual()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select rol
  from public.perfiles
  where id = auth.uid()
    and activo = true;
$$;

create or replace function public.es_dueno()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.rol_actual() = 'dueño';
$$;

-- ============================================================================
-- perfiles
-- ============================================================================
alter table public.perfiles enable row level security;

-- Dueño/a ve todos los perfiles; cualquier usuario autenticado ve el propio
-- (necesario para mostrar nombre + rol en el header).
create policy perfiles_select on public.perfiles
  for select
  using (public.es_dueno() or id = auth.uid());

-- Solo Dueño/a gestiona usuarios (alta de vendedores).
create policy perfiles_insert on public.perfiles
  for insert
  with check (public.es_dueno());

create policy perfiles_update on public.perfiles
  for update
  using (public.es_dueno())
  with check (public.es_dueno());

-- Sin policy de DELETE: dar de baja a un usuario se resuelve con activo = false (UPDATE),
-- no borrando el perfil.

-- ============================================================================
-- categorias — alta/gestión/baja: Dueño/a y Vendedor
-- ============================================================================
alter table public.categorias enable row level security;

create policy categorias_select on public.categorias
  for select
  using (public.rol_actual() is not null);

create policy categorias_insert on public.categorias
  for insert
  with check (public.rol_actual() is not null);

create policy categorias_update on public.categorias
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

create policy categorias_delete on public.categorias
  for delete
  using (public.rol_actual() is not null);

-- ============================================================================
-- productos — alta/gestión/baja: Dueño/a y Vendedor (sin exponer costos)
-- ============================================================================
alter table public.productos enable row level security;

create policy productos_select on public.productos
  for select
  using (public.rol_actual() is not null);

create policy productos_insert on public.productos
  for insert
  with check (public.rol_actual() is not null);

create policy productos_update on public.productos
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

create policy productos_delete on public.productos
  for delete
  using (public.rol_actual() is not null);

-- ============================================================================
-- productos_costos — SOLO Dueño/a (ver "Ver costos de productos" en la tabla)
-- ============================================================================
alter table public.productos_costos enable row level security;

create policy productos_costos_select on public.productos_costos
  for select
  using (public.es_dueno());

create policy productos_costos_insert on public.productos_costos
  for insert
  with check (public.es_dueno());

create policy productos_costos_update on public.productos_costos
  for update
  using (public.es_dueno())
  with check (public.es_dueno());

create policy productos_costos_delete on public.productos_costos
  for delete
  using (public.es_dueno());

-- ============================================================================
-- variantes — cargar/ajustar stock y gestión de productos: Dueño/a y Vendedor
-- ============================================================================
alter table public.variantes enable row level security;

create policy variantes_select on public.variantes
  for select
  using (public.rol_actual() is not null);

create policy variantes_insert on public.variantes
  for insert
  with check (public.rol_actual() is not null);

create policy variantes_update on public.variantes
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

create policy variantes_delete on public.variantes
  for delete
  using (public.rol_actual() is not null);

-- ============================================================================
-- ventas — vender (POS): Dueño/a y Vendedor
-- ============================================================================
alter table public.ventas enable row level security;

create policy ventas_select on public.ventas
  for select
  using (public.rol_actual() is not null);

create policy ventas_insert on public.ventas
  for insert
  with check (public.rol_actual() is not null);

create policy ventas_update on public.ventas
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

-- Sin policy de DELETE: es un registro financiero/de auditoría, no se borra vía API.

-- ============================================================================
-- venta_items — parte del flujo de venta: Dueño/a y Vendedor
-- ============================================================================
alter table public.venta_items enable row level security;

create policy venta_items_select on public.venta_items
  for select
  using (public.rol_actual() is not null);

create policy venta_items_insert on public.venta_items
  for insert
  with check (public.rol_actual() is not null);

create policy venta_items_update on public.venta_items
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

-- Sin policy de DELETE: es un registro financiero/de auditoría, no se borra vía API.

-- ============================================================================
-- ajustes_stock — cargar/ajustar stock: Dueño/a y Vendedor
-- ============================================================================
alter table public.ajustes_stock enable row level security;

create policy ajustes_stock_select on public.ajustes_stock
  for select
  using (public.rol_actual() is not null);

create policy ajustes_stock_insert on public.ajustes_stock
  for insert
  with check (public.rol_actual() is not null);

create policy ajustes_stock_update on public.ajustes_stock
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

-- Sin policy de DELETE: es un registro financiero/de auditoría, no se borra vía API.

-- ============================================================================
-- cajas — abrir/cerrar caja: Dueño/a y Vendedor (queda registrado quién la operó
-- mediante usuario_apertura_id / usuario_cierre_id)
-- ============================================================================
alter table public.cajas enable row level security;

create policy cajas_select on public.cajas
  for select
  using (public.rol_actual() is not null);

create policy cajas_insert on public.cajas
  for insert
  with check (public.rol_actual() is not null);

create policy cajas_update on public.cajas
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

-- Sin policy de DELETE: es un registro financiero/de auditoría, no se borra vía API.

-- ============================================================================
-- cuentas — registrar cuentas y cobrar/abonar: Dueño/a y Vendedor
-- ============================================================================
alter table public.cuentas enable row level security;

create policy cuentas_select on public.cuentas
  for select
  using (public.rol_actual() is not null);

create policy cuentas_insert on public.cuentas
  for insert
  with check (public.rol_actual() is not null);

create policy cuentas_update on public.cuentas
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

create policy cuentas_delete on public.cuentas
  for delete
  using (public.rol_actual() is not null);

-- ============================================================================
-- cuenta_pagos — cobrar/abonar cuentas: Dueño/a y Vendedor
-- ============================================================================
alter table public.cuenta_pagos enable row level security;

create policy cuenta_pagos_select on public.cuenta_pagos
  for select
  using (public.rol_actual() is not null);

create policy cuenta_pagos_insert on public.cuenta_pagos
  for insert
  with check (public.rol_actual() is not null);

create policy cuenta_pagos_update on public.cuenta_pagos
  for update
  using (public.rol_actual() is not null)
  with check (public.rol_actual() is not null);

-- Sin policy de DELETE: es un registro financiero/de auditoría, no se borra vía API.
