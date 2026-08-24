-- ═══════════════════════════════════════════════════════════════════════════
-- Ciclo de vida conectado: Cotización → Venta → Proyecto → Contrato.
-- Añade la dirección al contacto y los links que forman el "rastro".
-- Correr en el SQL Editor de Supabase. Todo aditivo e idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- Dirección del cliente (fuente de verdad para llenar contratos).
alter table public.contactos   add column if not exists direccion text;

-- De qué cotización nació la venta.
alter table public.ventas      add column if not exists cotizacion_id uuid references public.cotizaciones(id) on delete set null;

-- El proyecto puede saltar directo a su cotización de origen.
alter table public.proyectos   add column if not exists cotizacion_id uuid references public.cotizaciones(id) on delete set null;

-- El contrato cierra el rastro: apunta a venta y proyecto (ya tenía cotizacion_id y contacto_id).
alter table public.contratos   add column if not exists venta_id    uuid references public.ventas(id)    on delete set null;
alter table public.contratos   add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;

create index if not exists idx_ventas_cotizacion    on public.ventas(cotizacion_id);
create index if not exists idx_proyectos_cotizacion on public.proyectos(cotizacion_id);
create index if not exists idx_contratos_venta      on public.contratos(venta_id);
create index if not exists idx_contratos_proyecto   on public.contratos(proyecto_id);
