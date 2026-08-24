-- Carpeta de Drive asignada A MANO a un beat.
--
-- Por qué hace falta una tabla aparte:
--   · Los 52 beats "original" viven en data/drive-links.json, un archivo del
--     repo. En Vercel el sistema de archivos es de solo lectura, así que no hay
--     forma de corregir un link desde el panel sin volver a desplegar.
--   · Meterlos en la tabla `beats` los duplicaría en el catálogo (ahí viven los
--     "agregado", y el catálogo junta las dos fuentes).
--
-- Esta tabla es una CAPA ENCIMA: si un beat aparece aquí, esto gana sobre el
-- JSON y sobre beats.drive_folder_id. Sirve para los dos orígenes.

create table if not exists beat_carpetas (
  beat_id          text primary key,
  drive_folder_id  text not null,
  drive_subfolders jsonb,
  -- Lo que se vio en Drive al momento de guardar. Es una foto para el panel,
  -- NO la verdad: la auditoría siempre vuelve a contar contra Drive.
  archivos         jsonb,
  asignado_por     text,
  updated_at       timestamptz not null default now()
);

alter table beat_carpetas enable row level security;

-- Solo el service-role (las rutas del admin) entra. Sin políticas para anon.
drop policy if exists "beat_carpetas sin acceso publico" on beat_carpetas;

comment on table beat_carpetas is
  'Carpeta de Drive corregida a mano desde el panel. Gana sobre drive-links.json y beats.drive_folder_id.';
