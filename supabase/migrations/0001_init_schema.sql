-- ShowroomCiro — Schema inicial
-- Basado en docs/design.md ("Modelo de datos") y docs/requirements.md (sección 2).
--
-- Nota de diseño: se agrega la tabla `productos_costos`, que NO figura en el modelo de
-- design.md, para poder cumplir el requisito de requirements.md sección 2
-- ("Ver costos de productos": Dueño/a sí, Vendedor no). RLS en Postgres es row-level,
-- no column-level: no existe forma de exponer la tabla `productos` completa al Vendedor
-- pero ocultarle una sola columna (`costo`). Separarla en su propia tabla con su propio
-- RLS es la forma estándar de resolver esto a nivel de base de datos. Si preferís otro
-- enfoque (ej. resolverlo en el frontend/Edge Function en vez de a nivel DB), avisame.

-- ============================================================================
-- 1. perfiles (usuarios de la app, 1:1 con auth.users de Supabase Auth)
-- ============================================================================
create table public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre_usuario text not null unique,
  rol            text not null,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint chk_perfiles_rol check (rol in ('dueño', 'vendedor'))
);

comment on table public.perfiles is 'Perfil de usuario de la app (Dueño/a o Vendedor), vinculado 1:1 a auth.users.';

-- ============================================================================
-- 2. categorias
-- ============================================================================
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. productos
-- ============================================================================
create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  categoria_id uuid references public.categorias (id) on delete set null,
  precio       numeric(10, 2) not null,
  foto_url     text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint chk_productos_precio_no_negativo check (precio >= 0)
);

create index idx_productos_categoria_id on public.productos (categoria_id);

-- ============================================================================
-- 3b. productos_costos (ver nota de diseño arriba)
-- ============================================================================
create table public.productos_costos (
  producto_id uuid primary key references public.productos (id) on delete cascade,
  costo       numeric(10, 2) not null,
  created_at  timestamptz not null default now(),
  constraint chk_productos_costos_costo_no_negativo check (costo >= 0)
);

comment on table public.productos_costos is 'Costo de cada producto, separado de productos para poder restringir su lectura a Dueño/a vía RLS.';

-- ============================================================================
-- 4. variantes
-- ============================================================================
create table public.variantes (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  talle       text not null,
  color       text not null,
  sku         text not null unique,
  stock       integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint chk_variantes_stock_no_negativo check (stock >= 0),
  constraint uq_variantes_producto_talle_color unique (producto_id, talle, color)
);

create index idx_variantes_producto_id on public.variantes (producto_id);

-- ============================================================================
-- 5. ventas
-- ============================================================================
create table public.ventas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfiles (id),
  fecha        timestamptz not null default now(),
  total        numeric(10, 2) not null,
  medio_pago   text not null,
  estado_sync  text not null default 'sincronizada',
  created_at   timestamptz not null default now(),
  constraint chk_ventas_total_no_negativo check (total >= 0),
  constraint chk_ventas_medio_pago check (medio_pago in ('efectivo', 'transferencia', 'tarjeta')),
  constraint chk_ventas_estado_sync check (estado_sync in ('sincronizada', 'pendiente'))
);

create index idx_ventas_usuario_id on public.ventas (usuario_id);

-- ============================================================================
-- 6. venta_items
-- ============================================================================
create table public.venta_items (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references public.ventas (id) on delete cascade,
  variante_id      uuid not null references public.variantes (id),
  cantidad         integer not null,
  precio_unitario  numeric(10, 2) not null,
  constraint chk_venta_items_cantidad_positiva check (cantidad > 0),
  constraint chk_venta_items_precio_no_negativo check (precio_unitario >= 0)
);

create index idx_venta_items_venta_id on public.venta_items (venta_id);
create index idx_venta_items_variante_id on public.venta_items (variante_id);

-- ============================================================================
-- 7. ajustes_stock
-- ============================================================================
create table public.ajustes_stock (
  id          uuid primary key default gen_random_uuid(),
  variante_id uuid not null references public.variantes (id) on delete cascade,
  usuario_id  uuid not null references public.perfiles (id),
  tipo        text not null,
  cantidad    integer not null,
  motivo      text,
  fecha       timestamptz not null default now(),
  constraint chk_ajustes_stock_tipo check (tipo in ('suma', 'resta')),
  constraint chk_ajustes_stock_cantidad_positiva check (cantidad > 0)
);

create index idx_ajustes_stock_variante_id on public.ajustes_stock (variante_id);
create index idx_ajustes_stock_usuario_id on public.ajustes_stock (usuario_id);

-- ============================================================================
-- 8. cajas
-- ============================================================================
create table public.cajas (
  id                  uuid primary key default gen_random_uuid(),
  usuario_apertura_id uuid not null references public.perfiles (id),
  usuario_cierre_id   uuid references public.perfiles (id),
  monto_inicial       numeric(10, 2) not null,
  monto_esperado      numeric(10, 2),
  monto_contado       numeric(10, 2),
  diferencia          numeric(10, 2),
  fecha_apertura      timestamptz not null default now(),
  fecha_cierre        timestamptz,
  constraint chk_cajas_monto_inicial_no_negativo check (monto_inicial >= 0)
);

create index idx_cajas_usuario_apertura_id on public.cajas (usuario_apertura_id);
create index idx_cajas_usuario_cierre_id on public.cajas (usuario_cierre_id);

-- ============================================================================
-- 9. cuentas (agenda de clientes deudores / "fiados")
-- ============================================================================
create table public.cuentas (
  id               uuid primary key default gen_random_uuid(),
  cliente_nombre   text not null,
  cliente_telefono text,
  monto_total      numeric(10, 2) not null,
  fecha_limite     date not null,
  estado           text not null default 'al_dia',
  created_at       timestamptz not null default now(),
  constraint chk_cuentas_monto_total_no_negativo check (monto_total >= 0),
  constraint chk_cuentas_estado check (estado in ('al_dia', 'por_vencer', 'vencido', 'pagado'))
);

-- ============================================================================
-- 10. cuenta_pagos
-- ============================================================================
create table public.cuenta_pagos (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid not null references public.cuentas (id) on delete restrict,
  monto      numeric(10, 2) not null,
  fecha      timestamptz not null default now(),
  constraint chk_cuenta_pagos_monto_positivo check (monto > 0)
);

create index idx_cuenta_pagos_cuenta_id on public.cuenta_pagos (cuenta_id);
