-- Perfil de los usuarios del panel: nombre y foto.
--
-- `usuarios.nombre` ya existía pero estaba vacía en todos y no se pintaba en
-- ningún lado: el panel mostraba el correo crudo en el menú, en la bitácora y
-- en la lista del equipo.
--
-- La foto va en `usuarios` y no en `equipo` a propósito: `equipo` es la NÓMINA
-- (participación, sueldo, periodicidad) e incluye gente que no entra al panel;
-- además uno de los usuarios no tiene fila ahí. `usuarios` es la tabla de quién
-- entra, y el perfil de acceso le pertenece a ella.

alter table public.usuarios add column if not exists foto_url text;

-- Los nombres reales YA existen en `equipo`, ligados por correo. En vez de
-- pedirle a cada quien que escriba el suyo, se siembran. Sólo rellena lo vacío:
-- si alguien ya puso un nombre, no se pisa.
update public.usuarios u
   set nombre = e.nombre
  from public.equipo e
 where lower(e.email) = u.email
   and e.nombre is not null
   and (u.nombre is null or btrim(u.nombre) = '');

-- Bucket de las fotos. Público de lectura: es una foto de perfil de 256px que
-- se pinta en el menú; firmar cada URL costaría una llamada por render a cambio
-- de nada. La ESCRITURA no pasa por aquí — sube nuestra API con service-role
-- (ver app/api/admin/perfil/route.ts), así no hace falta ninguna política.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfiles', 'perfiles', true, 524288, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
