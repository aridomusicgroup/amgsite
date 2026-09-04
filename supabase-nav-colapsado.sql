-- Áreas del menú lateral que cada quien dejó colapsadas.
--
-- Va en `user_prefs` y no en localStorage a propósito: el menú se renderiza en
-- el SERVIDOR en cada página, así que con localStorage las áreas se dibujarían
-- abiertas y se cerrarían de golpe en cada navegación. Guardado aquí llega ya
-- colapsado y además sigue a la persona a cualquier dispositivo.
--
-- Guarda claves de área (`operacion`, `dinero`, `contenido`, `herramientas`),
-- no rutas: si mañana se mueve un módulo de área, no queda basura.

alter table public.user_prefs
  add column if not exists nav_colapsado text[] not null default '{}'::text[];
