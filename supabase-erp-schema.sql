-- ============================================================================
-- ARIDO ERP — Esquema base (CRM + Ventas + Inventario + Finanzas + Reparto)
-- Postgres / Supabase.  Hereda las 4 pestañas del sheet "INGRESOS Y EGRESOS":
--   INGRESOS        -> ventas
--   EGRESOS         -> egresos
--   CRM Y TRACKING  -> contactos (+ pipeline) + identidades_canal + interacciones
--   INVENTARIO DE BEATS -> inventario_beats
-- Compensación del equipo -> equipo + nomina + repartos + reparto_socio
--
-- Convención del proyecto: esquema public, RLS activado SIN policies públicas
-- (solo el service-role del backend accede; anon/auth no ven nada).
-- DISEÑO PARA REVISIÓN — aplicar a Supabase solo con autorización explícita.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ============================================================================
-- 1. CONTACTOS  (personas: clientes y leads)  ── pestaña CRM Y TRACKING + CLIENTE
-- ============================================================================
create table if not exists public.contactos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text,
  telefono        text,                       -- 🔑 llave maestra (WhatsApp/DMs)
  email           text,                       -- 🔑 llave maestra (BeatStars/Stripe/sitio)
  etapa           text not null default 'lead'
                    check (etapa in ('lead','negociacion','cliente','recurrente','perdido','inactivo')),
  origen          text,                       -- primer canal: Instagram, TikTok, whatsApp, BeatStars...
  servicio_interes text,                      -- Beat personalizado, Licencia, Exclusividad...
  motivo_perdida  text,                       -- solo si etapa='perdido' (ej. "Sin respuesta")
  ltv             numeric(12,2) default 0,    -- total comprado (se recalcula desde ventas)
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  notas           text,
  merged_into     uuid references public.contactos(id),  -- soft-merge: apunta a la ficha buena
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_contactos_telefono on public.contactos(telefono);
create index if not exists idx_contactos_email    on public.contactos(email);
create index if not exists idx_contactos_etapa     on public.contactos(etapa);

-- ============================================================================
-- 2. IDENTIDADES_CANAL  (las "caras" de una persona en cada canal)
--    Modelo "1 persona, N identidades". UNIQUE evita duplicar la misma identidad.
-- ============================================================================
create table if not exists public.identidades_canal (
  id                    uuid primary key default gen_random_uuid(),
  contacto_id           uuid not null references public.contactos(id) on delete cascade,
  canal                 text not null
                          check (canal in ('instagram','facebook','whatsapp','tiktok','beatstars','stripe','sitio')),
  identificador_externo text not null,        -- IGSID, PSID, número WA, email BeatStars, customer Stripe
  handle                text,                 -- @usuario visible
  display_name          text,
  last_seen_at          timestamptz,
  created_at            timestamptz default now(),
  unique (canal, identificador_externo)
);
create index if not exists idx_identidades_contacto on public.identidades_canal(contacto_id);

-- ============================================================================
-- 3. INVENTARIO_BEATS  ── pestaña INVENTARIO DE BEATS
--    Lista interna de beats con disponibilidad. Enlaza opcionalmente al
--    catálogo público (tabla public.beats / data/beats-beatstars.json).
-- ============================================================================
create table if not exists public.inventario_beats (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique,              -- B0001...
  nombre            text not null,
  estado            text not null default 'disponible'
                      check (estado in ('disponible','vendido','reservado')),
  catalogo_beat_id  text,                     -- id del beat en el catálogo público, si aplica
  notas             text,
  created_at        timestamptz default now()
);

-- ============================================================================
-- 4. VENTAS  ── pestaña INGRESOS
-- ============================================================================
create table if not exists public.ventas (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique,              -- I0001...
  fecha             date not null,
  contacto_id       uuid references public.contactos(id),
  tipo              text,                     -- Beat personalizado, Licencia básica, Exclusividad...
  beat_nombre       text,                     -- nombre del beat/proyecto vendido
  inventario_beat_id uuid references public.inventario_beats(id),
  canal             text,                     -- whatsApp, BeatStars, Instagram
  moneda            text default 'MXN',
  monto_cobrado     numeric(12,2),            -- en la moneda original
  tipo_cambio       numeric(10,4),
  total_mxn         numeric(12,2) not null,   -- normalizado a pesos
  medio_pago        text,                     -- ZELLE, PAYPAL, TRANSFERENCIA...
  costo_extra       numeric(12,2) default 0,  -- músicos de sesión (COGS de esta venta)
  extras            text,                     -- instrumentos/músicos (TOLOLOCHE, TROMBON...)
  canciones         text,                     -- lista de canciones (EP/Álbum) → tareas en Producción
  quien_cerro       text,                     -- atribución del equipo
  fecha_cierre      date,
  fecha_pago        date,
  fecha_inicio      date,
  fecha_entrega     date,
  split_legacy      jsonb,                    -- splits viejos (modelo "por producción") solo histórico
  created_at        timestamptz default now()
);
create index if not exists idx_ventas_contacto on public.ventas(contacto_id);
create index if not exists idx_ventas_fecha     on public.ventas(fecha);
create index if not exists idx_ventas_canal      on public.ventas(canal);

-- ============================================================================
-- 4b. PAGOS  (cobros de una venta: anticipo + finiquito / abonos)
--    Una venta = el TRATO (total_mxn).  Un pago = dinero que ENTRÓ, con su fecha.
--    INGRESO = suma de pagos (base efectivo).  Las ventas SIN pagos se tratan
--    como cobradas al 100% en su fecha (BeatStars / Stripe / histórico = pago
--    instantáneo), así el histórico no cambia y solo los anticipos usan pagos.
-- ============================================================================
create table if not exists public.pagos (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references public.ventas(id) on delete cascade,
  fecha       date not null,
  monto_mxn   numeric(12,2) not null,
  tipo        text not null default 'anticipo'
                check (tipo in ('anticipo','finiquito','abono','completo')),
  medio_pago  text,
  notas       text,
  created_at  timestamptz default now()
);
create index if not exists idx_pagos_venta on public.pagos(venta_id);
create index if not exists idx_pagos_fecha on public.pagos(fecha);
alter table public.pagos enable row level security;

-- ============================================================================
-- 4c. PROYECTOS  (control de producción + tareas internas del equipo)
--    Un proyecto = una producción a la medida (clase 'produccion', con cliente y
--    venta) O una tarea interna/contenido (clase 'interna', sin cliente).
--    Rastrea EL TRABAJO; el dinero vive en `ventas`, el cliente en `contactos`.
-- ============================================================================
create table if not exists public.proyectos (
  id                  uuid primary key default gen_random_uuid(),
  folio               text unique,                 -- P0001...
  clase               text not null default 'produccion'
                        check (clase in ('produccion','interna')),
  titulo              text not null,
  tipo                text,                        -- beat_personalizado, bp_letra, grabacion, mezcla_master, exclusividad, contenido, distribucion, admin...
  estado              text not null default 'cola'
                        check (estado in ('cola','produccion','revision','entregado','cerrado','pausado','cancelado')),
  prioridad           text default 'media' check (prioridad in ('baja','media','alta')),
  contacto_id         uuid references public.contactos(id) on delete set null,
  venta_id            uuid references public.ventas(id) on delete set null,
  order_id            uuid references public.orders(id) on delete set null,  -- pedido del sitio (sincroniza estado con Pedidos)
  responsable_id      uuid references public.equipo(id),
  fecha_inicio        date,
  fecha_entrega       date,                         -- entrega estimada
  fecha_entrega_real  date,
  brief               text,                         -- lo que pidió el cliente
  entregable_url      text,                         -- link a Drive / entregables
  notas               text,
  plataforma          text,                         -- contenido: Instagram/TikTok/YouTube/Facebook...
  fecha_publicacion   date,                         -- contenido: cuándo se publica
  link_post           text,                         -- contenido: link del post ya publicado
  creado_por          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists idx_proyectos_estado      on public.proyectos(estado);
create index if not exists idx_proyectos_responsable on public.proyectos(responsable_id);
create index if not exists idx_proyectos_contacto    on public.proyectos(contacto_id);

create table if not exists public.proyecto_tareas (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references public.proyectos(id) on delete cascade,
  titulo          text not null,
  hecho           boolean default false,
  completado_at   timestamptz,                 -- se sella al marcar ✓ (mide rendimiento)
  fecha           date,                        -- fecha de la tarea (aparece en el calendario)
  responsable_id  uuid references public.equipo(id),
  notas           text,                        -- detalle de la tarea (ventana grande)
  orden           int default 0,
  created_at      timestamptz default now()
);
create index if not exists idx_proyecto_tareas_proyecto on public.proyecto_tareas(proyecto_id);
create index if not exists idx_proyecto_tareas_responsable on public.proyecto_tareas(responsable_id);

-- Subtareas (1 nivel) dentro de una tarea
create table if not exists public.proyecto_subtareas (
  id          uuid primary key default gen_random_uuid(),
  tarea_id    uuid not null references public.proyecto_tareas(id) on delete cascade,
  titulo      text not null,
  hecho       boolean default false,
  orden       int default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_proyecto_subtareas_tarea on public.proyecto_subtareas(tarea_id);
alter table public.proyecto_subtareas enable row level security;
-- Subtareas asignables (2026-07-01): responsable por subtarea
alter table public.proyecto_subtareas add column if not exists responsable_id uuid references public.equipo(id);
-- Link del post por tarea (2026-07-04): cada reel = una tarea → liga métricas reales de Analítica
alter table public.proyecto_tareas add column if not exists link_post text;
-- Multi-responsable por proyecto (2026-07-04): equipo del proyecto (responsable_id sigue siendo el "lead")
alter table public.proyectos add column if not exists responsables uuid[];

-- Registro de horas (servicio social de Leo + cualquier colaborador)
create table if not exists public.equipo_horas (
  id          uuid primary key default gen_random_uuid(),
  equipo_id   uuid not null references public.equipo(id) on delete cascade,
  fecha       date not null default current_date,
  horas       numeric(5,2) not null,
  nota        text,
  created_at  timestamptz default now()
);
create index if not exists idx_equipo_horas_equipo on public.equipo_horas(equipo_id);

alter table public.proyectos       enable row level security;
alter table public.proyecto_tareas enable row level security;
alter table public.equipo_horas    enable row level security;

-- Leo Tristán (servicio social) al equipo, para asignarlo como responsable
insert into public.equipo (nombre, rol, participacion_pct, pago_base, periodicidad, pago_variable, notas)
select 'Leo Tristán', 'colaborador', 0, 0, 'semanal', false, 'Servicio social; apoya en producción/edición y contenido.'
where not exists (select 1 from public.equipo where nombre = 'Leo Tristán');

-- ============================================================================
-- 4d. USER_PREFS  (preferencias por usuario del panel + accesos por admin)
-- ============================================================================
create table if not exists public.user_prefs (
  email         text primary key,
  font_size     text default 'md',     -- sm | md | lg
  theme         text default 'dark',   -- dark | light (modo claro se implementa después)
  module_order  jsonb,                 -- orden personalizado del nav: ["/admin/produccion", ...]
  modules_extra jsonb,                 -- módulos opcionales habilitados por un admin
  updated_at    timestamptz default now()
);
alter table public.user_prefs enable row level security;

-- ============================================================================
-- 5. INTERACCIONES  (timeline 360° por contacto: mensajes, ventas, seguimiento)
-- ============================================================================
create table if not exists public.interacciones (
  id            uuid primary key default gen_random_uuid(),
  contacto_id   uuid not null references public.contactos(id) on delete cascade,
  canal         text,
  tipo          text not null
                  check (tipo in ('mensaje_in','mensaje_out','venta','lead_form','click_utm','seguimiento','nota')),
  resumen       text,
  venta_id      uuid references public.ventas(id),
  ocurrio_at    timestamptz default now(),
  metadata      jsonb
);
create index if not exists idx_interacciones_contacto on public.interacciones(contacto_id);

-- ============================================================================
-- 6. EQUIPO  (socios y colaboradores)
-- ============================================================================
create table if not exists public.equipo (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  email             text,                       -- correo de acceso (para que cada quien vea su tarjeta de rendimiento)
  rol               text not null check (rol in ('socio','colaborador')),
  participacion_pct numeric(5,2) default 0,   -- 50 para socios; 0 para colaboradores
  pago_base         numeric(12,2) default 0,  -- monto por periodo (sueldo)
  periodicidad      text default 'semanal' check (periodicidad in ('semanal','quincenal','mensual')),
  pago_variable     boolean default false,    -- true: el monto varía (ej. Tozi por indicadores)
  activo            boolean default true,
  desde             date,
  notas             text,
  created_at        timestamptz default now()
);

-- ============================================================================
-- 7. NOMINA  (cada pago de sueldo; el de colaboradores variables cambia c/semana)
-- ============================================================================
create table if not exists public.nomina (
  id              uuid primary key default gen_random_uuid(),
  persona_id      uuid not null references public.equipo(id),
  periodo_inicio  date not null,              -- inicio de la semana pagada
  periodo_fin     date,
  monto           numeric(12,2) not null,
  tipo            text default 'sueldo' check (tipo in ('sueldo','bono','ajuste')),
  estado          text default 'pendiente' check (estado in ('pendiente','pagado')),
  fecha_pago      date,
  notas           text,
  created_at      timestamptz default now()
);
create index if not exists idx_nomina_persona on public.nomina(persona_id);

-- ============================================================================
-- 8. EGRESOS  ── pestaña EGRESOS
-- ============================================================================
create table if not exists public.egresos (
  id              uuid primary key default gen_random_uuid(),
  folio           text,                       -- E0001...
  fecha           date not null,
  categoria       text,                       -- Renta Estudio, Renta Notion, Servicios, Equipo, Pago músico...
  proveedor       text,
  descripcion     text,
  monto_sin_iva   numeric(12,2),
  iva             numeric(12,2) default 0,
  total_mxn       numeric(12,2) not null,
  es_capex        boolean default false,      -- true: inversión (equipo/gear), NO gasto recurrente
  created_at      timestamptz default now()
);
create index if not exists idx_egresos_fecha     on public.egresos(fecha);
create index if not exists idx_egresos_categoria on public.egresos(categoria);

-- ============================================================================
-- 9. REPARTOS  (utilidad trimestral)  + 10. REPARTO_SOCIO (corte por socio)
--    Cascada: ingresos − costos_directos − gastos_operativos − nomina − reserva
--             = utilidad_repartible  →  se reparte por participacion_pct.
-- ============================================================================
create table if not exists public.repartos (
  id                  uuid primary key default gen_random_uuid(),
  periodo             text not null,          -- ej. '2026-T1'
  fecha_inicio        date,
  fecha_fin           date,
  ingresos            numeric(12,2) default 0,
  costos_directos     numeric(12,2) default 0,   -- músicos / COGS
  gastos_operativos   numeric(12,2) default 0,   -- renta, subs, comisiones, ads (excluye capex)
  nomina              numeric(12,2) default 0,   -- sueldos del periodo (socios + colaboradores)
  reserva_pct         numeric(5,2) default 15,
  reserva_monto       numeric(12,2) default 0,
  utilidad_repartible numeric(12,2) default 0,
  estado              text default 'borrador' check (estado in ('borrador','cerrado','pagado')),
  notas               text,
  created_at          timestamptz default now()
);
create table if not exists public.reparto_socio (
  id                uuid primary key default gen_random_uuid(),
  reparto_id        uuid not null references public.repartos(id) on delete cascade,
  socio_id          uuid not null references public.equipo(id),
  participacion_pct numeric(5,2) not null,
  monto             numeric(12,2) not null,
  estado            text default 'pendiente' check (estado in ('pendiente','pagado')),
  fecha_pago        date
);

-- ============================================================================
-- RLS — bloqueado para anon/auth; solo el service-role del backend accede.
-- ============================================================================
alter table public.contactos        enable row level security;
alter table public.identidades_canal enable row level security;
alter table public.inventario_beats enable row level security;
alter table public.ventas           enable row level security;
alter table public.interacciones    enable row level security;
alter table public.equipo           enable row level security;
alter table public.nomina           enable row level security;
alter table public.egresos          enable row level security;
alter table public.repartos         enable row level security;
alter table public.reparto_socio    enable row level security;

-- ============================================================================
-- SEMILLA DEL EQUIPO (ajustar montos a la decisión final)
--   Socios 50/50: Luis (altiplano) y Eliud — base recomendado para arrancar $1,200/sem.
--   Colaboradores: Tozi (Emmanuel Cervantes) ~$1,700/sem variable; Diego Galván $800/sem.
-- ============================================================================
insert into public.equipo (nombre, rol, participacion_pct, pago_base, periodicidad, pago_variable, notas)
values
  ('Luis',            'socio',       50, 1200, 'semanal', false, 'Socio fundador (altiplano). Base escalonado: subir cuando promedio 3 meses > $45k.'),
  ('Eliud',           'socio',       50, 1200, 'semanal', false, 'Socio fundador. Mismo esquema escalonado que Luis.'),
  ('Emmanuel Cervantes (Tozi)','colaborador', 0, 1700, 'semanal', true,  'Pago variable según indicadores/KPIs.'),
  ('Diego Galván',    'colaborador', 0,  800, 'semanal', false, 'Recién integrado al equipo.')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- ANALÍTICA SOCIAL (Instagram/Facebook) — 2026-07-04
-- Métricas del contenido, sincronizadas desde la Graph API de Meta.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.social_cuentas (
  id           uuid primary key default gen_random_uuid(),
  plataforma   text not null check (plataforma in ('instagram','facebook')),
  nombre       text not null,
  external_id  text not null,               -- IG User ID o Page ID
  page_id      text,                        -- Page ID vinculada (para IG)
  activo       boolean default true,
  created_at   timestamptz default now(),
  unique (plataforma, external_id)
);

create table if not exists public.social_snapshots (
  id           uuid primary key default gen_random_uuid(),
  cuenta_id    uuid not null references public.social_cuentas(id) on delete cascade,
  fecha        date not null default current_date,
  seguidores   int,
  alcance      int,
  created_at   timestamptz default now(),
  unique (cuenta_id, fecha)
);

create table if not exists public.social_posts (
  id             uuid primary key default gen_random_uuid(),
  cuenta_id      uuid not null references public.social_cuentas(id) on delete cascade,
  media_id       text not null,
  tipo           text,                       -- IMAGE / VIDEO / CAROUSEL_ALBUM / REELS
  permalink      text,
  caption        text,
  thumbnail_url  text,
  publicado_at   timestamptz,
  likes          int default 0,
  comentarios    int default 0,
  guardados      int default 0,
  compartidos    int default 0,
  alcance        int default 0,
  reproducciones int default 0,
  actualizado_at timestamptz default now(),
  unique (cuenta_id, media_id)
);
create index if not exists idx_social_snapshots_cuenta on public.social_snapshots(cuenta_id);
create index if not exists idx_social_posts_cuenta on public.social_posts(cuenta_id);
alter table public.social_cuentas  enable row level security;
alter table public.social_snapshots enable row level security;
alter table public.social_posts    enable row level security;

-- Semilla: cuenta de Latino Gang Beats (IG User ID + Page ID vinculada)
insert into public.social_cuentas (plataforma, nombre, external_id, page_id)
select 'instagram', 'Latino Gang Beats', '17841460246708820', '830244123502621'
where not exists (select 1 from public.social_cuentas where external_id = '17841460246708820');

-- ── Bitácora de actividad del panel de Producción (2026-07-07) ────────────────
-- Feed in-app (campanita 🔔): registra creación de proyectos, asignación y
-- completado de tareas/subtareas, con quién lo hizo. Best-effort desde lib/actividad.ts.
create table if not exists public.actividad (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  actor text,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tarea_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists actividad_created_idx on public.actividad (created_at desc);
alter table public.actividad enable row level security;

-- ── Suscripciones Web Push (notificaciones al panel anclado) 2026-07-08 ───────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,               -- correo del usuario (para dirigir el push a sus dispositivos)
  endpoint text unique not null,     -- endpoint del navegador/dispositivo
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_email on public.push_subscriptions(email);
alter table public.push_subscriptions enable row level security;
