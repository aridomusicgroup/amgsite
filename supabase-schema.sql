-- ============================================================
-- SISTEMA ARIDO — Schema inicial (Fase A)
-- Pegar y ejecutar en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Clientes (se crean/actualizan solos con cada venta)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  phone text,
  first_seen timestamptz not null default now(),
  notes text,
  tags text[] default '{}'
);

-- Pedidos (una fila por pago de Stripe)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  customer_id uuid references customers(id),
  type text not null check (type in ('beat', 'servicio')),
  status text not null default 'nuevo'
    check (status in ('nuevo', 'en_produccion', 'revision', 'entregado', 'cancelado')),
  total numeric not null,
  currency text not null,
  summary text,
  note text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  landing text,
  lang text default 'es',
  created_at timestamptz not null default now()
);

-- Conceptos de cada pedido
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  description text not null,
  amount numeric not null,
  quantity int not null default 1
);

-- Egresos (Fase B: captura manual, opcionalmente ligados a un pedido)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  amount numeric not null,
  currency text not null default 'MXN',
  category text not null,
  description text,
  order_id uuid references orders(id),
  receipt_url text,
  folio text,
  created_at timestamptz not null default now()
);

-- Ingresos manuales (Fase B: BeatStars, efectivo, transferencias...)
create table if not exists manual_income (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  amount numeric not null,
  currency text not null default 'MXN',
  source text not null,
  description text,
  folio text,
  created_at timestamptz not null default now()
);

-- Índices para los tableros
create index if not exists idx_orders_created on orders (created_at desc);
create index if not exists idx_orders_type on orders (type);
create index if not exists idx_orders_customer on orders (customer_id);
create index if not exists idx_expenses_date on expenses (date desc);
create index if not exists idx_manual_income_date on manual_income (date desc);

-- Seguridad: RLS activado sin políticas públicas.
-- Solo el servidor (service_role key) puede leer/escribir.
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table expenses enable row level security;
alter table manual_income enable row level security;
