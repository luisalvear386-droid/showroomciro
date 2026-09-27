-- ShowroomCiro — Storage: bucket de fotos de producto
-- Requiere 0002_rls_policies.sql ya aplicada (usa `public.rol_actual()`).
--
-- Motivo: el bucket `fotos-productos` se había creado a mano desde el dashboard y no
-- quedaba versionado; si se recreaba la base desde las migraciones, no existía.
--
-- Idempotente: se puede aplicar sobre un proyecto donde el bucket ya exista.
--   - El bucket se inserta con `on conflict do update`, así queda con la configuración
--     de acá aunque se haya creado a mano con otra (ej. privado o sin límite de tamaño).
--   - Las políticas se borran (si existen) y se vuelven a crear.
--
-- Contenido:
--   1. Bucket `fotos-productos` (público, solo imágenes, máx. 5 MB).
--   2. Políticas sobre `storage.objects`:
--        SELECT: cualquiera (el bucket es público).
--        INSERT / UPDATE: solo usuarios autenticados con perfil activo (Dueño/a o Vendedor,
--        los dos pueden dar de alta y editar productos según requirements.md sección 2).
--        DELETE: sin política. Los productos no se borran, se desactivan (`activo = false`),
--        y los reportes de top productos siguen mostrando `foto_url` de productos viejos:
--        borrar la foto rompería ese historial.
--
-- Convención sugerida para el Módulo 5: una foto por producto en una ruta fija
-- (`<producto_id>.<ext>`) subida con `upsert: true`, así reemplazar la foto pisa el archivo
-- en vez de dejar huérfanos. Como la URL pública queda igual, agregar `?v=<timestamp>` al
-- guardar `productos.foto_url` para que el navegador/CDN no muestre la foto vieja.

-- ============================================================================
-- 1. Bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-productos',
  'fotos-productos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 2. Políticas sobre storage.objects
-- ============================================================================
-- `storage.objects` ya viene con RLS activado en Supabase.

-- Lectura pública. Las URLs públicas (/object/public/...) funcionan igual sin esta
-- política; la necesitan list()/download() de la API y el `upsert` al reemplazar una foto.
drop policy if exists fotos_productos_select on storage.objects;
create policy fotos_productos_select on storage.objects
  for select
  using (bucket_id = 'fotos-productos');

drop policy if exists fotos_productos_insert on storage.objects;
create policy fotos_productos_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'fotos-productos'
    and public.rol_actual() is not null
  );

drop policy if exists fotos_productos_update on storage.objects;
create policy fotos_productos_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'fotos-productos'
    and public.rol_actual() is not null
  )
  with check (
    bucket_id = 'fotos-productos'
    and public.rol_actual() is not null
  );

-- Sin policy de DELETE (ver nota al inicio).
