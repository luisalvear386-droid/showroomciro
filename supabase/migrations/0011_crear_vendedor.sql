-- ShowroomCiro — Alta de Vendedores desde la app
-- Requiere 0001 a 0010 ya aplicadas.
--
-- Motivo: crear un usuario de Supabase Auth necesita privilegios que el cliente del
-- frontend (anon key + sesión del Dueño/a) no tiene. En vez de sumar una Edge Function
-- con la service role key, se resuelve con una función Postgres `security definer`, mismo
-- criterio que `cerrar_caja()`, `registrar_venta()` y `registrar_pago()`: una sola
-- transacción que crea el usuario en `auth.users` y su fila en `perfiles`.
--
-- El alta en `auth.users` replica lo que hace `supabase/seed.sql` (email técnico
-- `<nombre_usuario>@showroomciro.internal`, contraseña con bcrypt, email ya confirmado).
--
-- Baja / reactivación: no pasan por acá. Se hacen con UPDATE de `perfiles.activo`, que la
-- policy `perfiles_update` (0002) ya permite solo al Dueño/a. Un perfil inactivo no tiene
-- rol (`rol_actual()` devuelve null), así que el RLS le niega todo aunque tenga sesión.
--
-- Uso desde el frontend (Módulo 9, Gestión de Usuarios):
--   supabase.rpc('crear_vendedor', { p_nombre_usuario, p_contrasena })
--   → devuelve la fila de `perfiles` creada.
--
-- Errores (el mensaje está pensado para mostrarse tal cual en la pantalla):
--   42501  quien llama no es Dueño/a activo
--   22023  nombre de usuario o contraseña inválidos
--   23505  el nombre de usuario ya existe

create or replace function public.crear_vendedor(
  p_nombre_usuario text,
  p_contrasena     text
)
returns public.perfiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text;
  v_email   text;
  v_id      uuid := gen_random_uuid();
  v_perfil  public.perfiles;
begin
  if not coalesce(public.es_dueno(), false) then
    raise exception 'Solo el Dueño/a puede crear usuarios'
      using errcode = '42501';
  end if;

  -- Mismo formato que valida el Login (src/lib/auth.ts)
  v_usuario := lower(trim(coalesce(p_nombre_usuario, '')));
  if v_usuario !~ '^[a-z0-9._-]+$' then
    raise exception 'El nombre de usuario solo puede tener letras, números, punto, guion y guion bajo, sin espacios.'
      using errcode = '22023';
  end if;

  -- 6 caracteres: el mínimo por defecto de Supabase Auth
  if length(coalesce(p_contrasena, '')) < 6 then
    raise exception 'La contraseña tiene que tener al menos 6 caracteres.'
      using errcode = '22023';
  end if;

  v_email := v_usuario || '@showroomciro.internal';

  if exists (select 1 from public.perfiles where nombre_usuario = v_usuario)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ese nombre de usuario ya existe.'
      using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated', 'authenticated',
    v_email,
    extensions.crypt(p_contrasena, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  );

  insert into public.perfiles (id, nombre_usuario, rol, activo)
  values (v_id, v_usuario, 'vendedor', true)
  returning * into v_perfil;

  return v_perfil;
end;
$$;

comment on function public.crear_vendedor(text, text) is
  'Alta de Vendedor (auth.users + perfiles) en una transacción. Solo Dueño/a.';

revoke all on function public.crear_vendedor(text, text) from public, anon;
grant execute on function public.crear_vendedor(text, text) to authenticated;
