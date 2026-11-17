-- ShowroomCiro — Storage: borrar la foto reemplazada de un producto
-- Requiere 0005_storage.sql ya aplicada.
--
-- Motivo: el Service Worker guarda las fotos de producto en caché (CacheFirst, ver
-- vite.config.ts). Para que nunca se muestre una versión vieja, cada foto subida usa un
-- nombre de archivo único (`<producto_id>/<uuid>.<ext>`) en vez de pisar la ruta fija
-- `<producto_id>.<ext>` de 0005. Así, al reemplazar la foto, el archivo anterior queda
-- huérfano: la app lo borra después de guardar la nueva URL en `productos.foto_url`.
--
-- 0005 no tenía política de DELETE porque "borrar la foto rompería el historial" de los
-- reportes. No es así para la foto reemplazada: los reportes (0003) leen `productos.foto_url`
-- actual con un join, nunca guardan la URL. Solo se borra la foto que dejó de usarse; la de
-- un producto dado de baja sigue en su lugar.
--
-- Hasta que se aplique esta migración, el borrado no hace nada (Storage filtra por RLS sin
-- devolver error): la foto vieja queda en el bucket, sin afectar a la app.
--
-- Idempotente: la política se borra (si existe) y se vuelve a crear.

drop policy if exists fotos_productos_delete on storage.objects;
create policy fotos_productos_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'fotos-productos'
    and public.rol_actual() is not null
  );
