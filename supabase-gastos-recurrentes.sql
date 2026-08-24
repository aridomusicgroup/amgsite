-- Registro EXPLÍCITO de pagos recurrentes (renta, suscripciones, préstamos…).
-- Complementa (no reemplaza) la inferencia por patrón de `egresos` que ya
-- corre en lib/gastos-recurrentes.ts: un registro de aquí GANA sobre lo
-- detectado automático para su misma categoría+proveedor, y no depende de
-- historial — avisa desde el día uno, aunque nunca se haya capturado antes.
create table if not exists public.gastos_recurrentes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,                 -- "Renta del estudio"
  categoria       text,                           -- para casar con egresos.categoria
  proveedor       text,                           -- para casar con egresos.proveedor
  monto_estimado  numeric not null default 0,
  dia_mes         integer not null check (dia_mes between 1 and 31),
  activo          boolean not null default true,  -- pausado = no avisa
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_gastos_recurrentes_activo on public.gastos_recurrentes(activo);

-- RLS sin policies: solo el service-role (rutas del servidor) entra, igual
-- que egresos/ingresos.
alter table public.gastos_recurrentes enable row level security;

comment on table public.gastos_recurrentes is
  'Pagos recurrentes registrados a mano (renta, suscripciones…). Gana sobre la inferencia automática de egresos para su misma clave.';
