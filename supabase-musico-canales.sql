-- ============================================================================
-- Canales por instrumento: cuando el músico manda MÁS DE UN archivo (2026-09-04)
-- ============================================================================
-- Martín siempre manda dos charchetas: la primera voz, que se panea a la
-- izquierda, y la segunda, a la derecha. En la plantilla eso ya existe — el
-- grupo CHARCHETAS tiene dos hijas, "L" y "R".
--
-- Hasta ahora el import siempre creaba una pista nueva. Con esto, cuando el
-- instrumento tiene canales definidos, el audio entra en la pista que YA existe
-- dentro de esa carpeta, sin crear nada.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- Lista ORDENADA de canales dentro de la carpeta destino, separados por coma.
-- El orden es el que ve el músico en su portal: el primer canal es su "pista 1".
-- Vacío = como antes, una pista nueva junto al destino.
--
-- Sólo se buscan las hijas DIRECTAS de la carpeta: en la plantilla "C414",
-- "TLM103" y "LINE" se repiten en cuatro carpetas (HI GTR, REQUINTO, ARMONÍA,
-- BAJO/TOLO), así que un nombre suelto caería en la equivocada.
alter table public.instrumento_pistas add column if not exists canales text;

-- A cuál de esos canales corresponde el archivo. Lo elige el músico al subir
-- (su portal le muestra un botón por canal), no se adivina por el orden en que
-- suba las cosas: si se equivocara de orden, las dos voces quedarían cruzadas
-- y nadie se enteraría hasta abrir el proyecto.
alter table public.musico_archivos add column if not exists slot smallint not null default 0;

update public.instrumento_pistas set canales = 'L, R', updated_at = now()
 where instrumento = 'Charchetas';

comment on column public.instrumento_pistas.canales is
  'Canales (hijas directas de la carpeta destino) en orden, separados por coma. Vacío = pista nueva.';
comment on column public.musico_archivos.slot is
  'Índice del canal al que va este archivo, 0-based contra instrumento_pistas.canales.';
