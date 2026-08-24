-- Credenciales de acceso de CLIENTES (panel /cuenta), aisladas del admin.
-- El admin usa Supabase Auth; los clientes usan este login ligero por correo +
-- contraseña (hash scrypt). El magic-link sigue existiendo como "crear/olvidé
-- contraseña". Una fila por correo.

create table if not exists public.cliente_credenciales (
  email         text primary key,
  password_hash text not null,          -- scrypt: "saltHex:hashHex"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS habilitado sin policies: sólo el service-role (backend) lee/escribe.
alter table public.cliente_credenciales enable row level security;
