-- Control de acceso al panel en la BASE DE DATOS (adiós dependencia de Vercel).
-- La tabla `usuarios` es la fuente de verdad de quién entra, con qué rol y si
-- está activo. El login (getSession) la consulta, con respaldo a las variables
-- de entorno para no dejar a nadie fuera durante la migración.

create table if not exists public.usuarios (
  email      text primary key,
  rol        text not null default 'produccion' check (rol in ('admin','crm','produccion')),
  activo     boolean not null default true,
  nombre     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.usuarios enable row level security;  -- solo service-role la escribe/lee

-- El tiempo real ahora sigue al acceso: un usuario ACTIVO recibe la transmisión.
-- (Se mantiene el respaldo a la tabla `staff` por si algún correo aún no migró.)
create or replace function public.is_staff()
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.usuarios u where u.email = (auth.jwt() ->> 'email') and u.activo)
      or exists (select 1 from public.staff    s where s.email = (auth.jwt() ->> 'email'));
$$;
