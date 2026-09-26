-- ShowroomCiro — Datos de prueba
--
-- Crea 2 usuarios (Dueño/a y Vendedor) directamente en auth.users + public.perfiles,
-- 2 categorías, 1 producto con 2 variantes (talle/color/stock distintos) y su costo.
--
-- IMPORTANTE:
-- - Las contraseñas de prueba son "changeme123" para ambos usuarios. Cambiarlas antes
--   de usar esto en un entorno real.
-- - Insertar filas directamente en auth.users es válido para seed/desarrollo, pero en
--   producción lo normal es crear usuarios vía Supabase Auth (Admin API / Edge Function),
--   que es lo que design.md describe para el alta de vendedores desde la app.
-- - Requiere el schema de 0001_init_schema.sql y las policies de 0002_rls_policies.sql
--   ya aplicadas.

-- ============================================================================
-- Usuarios (auth.users + perfiles)
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'ciro@showroomciro.internal',
    extensions.crypt('changeme123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'vendedor1@showroomciro.internal',
    extensions.crypt('changeme123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  );

insert into public.perfiles (id, nombre_usuario, rol, activo) values
  ('11111111-1111-1111-1111-111111111111', 'ciro', 'dueño', true),
  ('22222222-2222-2222-2222-222222222222', 'vendedor1', 'vendedor', true);

-- ============================================================================
-- Categorías
-- ============================================================================
insert into public.categorias (id, nombre) values
  ('33333333-3333-3333-3333-333333333333', 'Remeras'),
  ('44444444-4444-4444-4444-444444444444', 'Pantalones');

-- ============================================================================
-- Producto + costo
-- ============================================================================
insert into public.productos (id, nombre, descripcion, categoria_id, precio, foto_url, activo) values
  (
    '55555555-5555-5555-5555-555555555555',
    'Remera Oversize Básica',
    'Remera de algodón peinado 24/1, corte oversize.',
    '33333333-3333-3333-3333-333333333333',
    15000.00,
    null,
    true
  );

insert into public.productos_costos (producto_id, costo) values
  ('55555555-5555-5555-5555-555555555555', 6500.00);

-- ============================================================================
-- Variantes (talle + color distintos, con stock)
-- ============================================================================
insert into public.variantes (id, producto_id, talle, color, sku, stock) values
  (
    '66666666-6666-6666-6666-666666666666',
    '55555555-5555-5555-5555-555555555555',
    'M', 'Azul', 'REM-OVR-AZ-M-0001', 10
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '55555555-5555-5555-5555-555555555555',
    'L', 'Negro', 'REM-OVR-NG-L-0002', 5
  );
