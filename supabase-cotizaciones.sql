-- ═══════════════════════════════════════════════════════════════════════════
-- Cotizaciones y Contratos — sección del panel admin.
-- Correr en el SQL Editor de Supabase. Seguro de re-correr (IF NOT EXISTS).
-- RLS activado sin policies: solo el service-role (el backend) accede. Igual que
-- el resto del esquema de ARIDO.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists cotizaciones (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique,
  contacto_id       uuid references contactos(id) on delete set null,
  cliente_nombre    text,
  cliente_email     text,
  cliente_telefono  text,
  cliente_direccion text,
  moneda            text not null default 'MXN',
  items             jsonb not null default '[]'::jsonb,   -- [{label, qty, unitPrice}]
  descuento         numeric not null default 0,
  total             numeric not null default 0,
  notas             text,
  vigencia_dias     integer not null default 15,
  estado            text not null default 'borrador',     -- borrador|enviada|aceptada|rechazada|vencida
  creado_por        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_cotizaciones_created on cotizaciones (created_at desc);
create index if not exists idx_cotizaciones_contacto on cotizaciones (contacto_id);

create table if not exists contratos (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique,
  tipo              text not null default 'generico',     -- exclusiva|produccion|servicio|generico
  cotizacion_id     uuid references cotizaciones(id) on delete set null,
  contacto_id       uuid references contactos(id) on delete set null,
  cliente_nombre    text,
  cliente_email     text,
  cliente_telefono  text,
  cliente_direccion text,
  moneda            text not null default 'MXN',
  monto             numeric not null default 0,
  concepto          text,
  items             jsonb not null default '[]'::jsonb,
  clausulas_extra   text,
  notas             text,
  estado            text not null default 'borrador',     -- borrador|enviado|firmado|cancelado
  creado_por        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_contratos_created on contratos (created_at desc);
create index if not exists idx_contratos_contacto on contratos (contacto_id);

alter table cotizaciones enable row level security;
alter table contratos    enable row level security;
