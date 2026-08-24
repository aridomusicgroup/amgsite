-- Correos adicionales de un cliente: un correo "alias" que ve los MISMOS pedidos
-- y contratos que su correo principal en el panel de cliente (/cuenta).
-- Lo liga el admin desde Clientes. Solo lectura server-side (service-role).
create table if not exists public.cliente_alias (
  alias_email     text primary key,          -- el correo adicional (llave: un alias apunta a un solo principal)
  principal_email text not null,             -- el correo dueño de los pedidos
  created_at      timestamptz not null default now()
);

create index if not exists idx_cliente_alias_principal on public.cliente_alias(principal_email);

alter table public.cliente_alias enable row level security;  -- sin policies: solo service-role
