-- Plantillas EDITABLES de contratos y cotización.
-- El equipo edita estos textos desde /admin/cotizaciones (pestaña Plantillas).
-- Si no hay fila para un tipo, el código usa su semilla (lib/pdf/plantilla-seeds.ts),
-- así el PDF nunca se rompe aunque la tabla esté vacía.

create table if not exists public.plantillas (
  tipo        text primary key,           -- beat_personalizado | exclusiva | produccion | servicio | generico | cotizacion
  titulo      text,                        -- título del contrato (no aplica a cotizacion)
  cuerpo      text,                        -- cuerpo del contrato (con {{campos}} y markup)
  terminos    text,                        -- términos del pie (solo tipo = cotizacion)
  updated_at  timestamptz not null default now(),
  updated_por text
);

-- RLS habilitado sin policies: sólo el service-role (backend) puede leer/escribir.
alter table public.plantillas enable row level security;
