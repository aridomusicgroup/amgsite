-- Fase C del plan de pagos: para poder crear el proyecto de un EP/Álbum solo
-- (sin que el staff tenga que decirlo a mano), la cotización necesita guardar
-- CUÁL de los dos es — hoy "EP / Álbum" es un solo tipo de contrato, no distingue.
alter table cotizaciones add column if not exists ep_album_formato text;
