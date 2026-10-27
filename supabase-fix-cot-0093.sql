-- COT-0093 "De negro": quedó ligada al cliente equivocado (otro "José") por un
-- id de contacto que se quedó pegado en el formulario. Este script la liga al
-- cliente correcto, que se crea aquí con los datos que ya trae la cotización.
--
-- PASO 1 — correr SOLO este SELECT y revisar (¿el correo de la cotización es el bueno?)
select c.folio, c.cliente_nombre, c.cliente_email, c.cliente_telefono,
       c.contacto_id            as contacto_actual_id,
       k.nombre                 as contacto_actual_nombre,
       k.email                  as contacto_actual_email,
       (select count(*) from public.proyectos p where p.cotizacion_id = c.id) as proyectos,
       (select count(*) from public.ventas v    where v.cotizacion_id = c.id) as ventas,
       (select count(*) from public.contratos t where t.cotizacion_id = c.id) as contratos
from public.cotizaciones c
left join public.contactos k on k.id = c.contacto_id
where c.folio = 'COT-0093';

-- PASO 2 — si todo cuadra, correr este bloque (una sola vez).
-- Si el correo de la cotización NO es el correcto, cámbialo en la cotización
-- (Editar COT-0093) y vuelve al paso 1 antes de correr esto.
do $$
declare
  cot   public.cotizaciones%rowtype;
  nuevo uuid;
begin
  select * into cot from public.cotizaciones where folio = 'COT-0093';
  if not found then raise exception 'No existe COT-0093'; end if;
  if coalesce(trim(cot.cliente_nombre), '') = '' then raise exception 'La cotización no trae nombre de cliente'; end if;

  -- ¿Ya existe un cliente con ese correo? (por si lo crearon a mano mientras tanto)
  select id into nuevo from public.contactos
   where merged_into is null
     and cot.cliente_email is not null
     and lower(email) = lower(cot.cliente_email)
   limit 1;

  if nuevo is null then
    insert into public.contactos (nombre, email, telefono, direccion, etapa)
    values (trim(cot.cliente_nombre), lower(cot.cliente_email), cot.cliente_telefono, cot.cliente_direccion, 'lead')
    returning id into nuevo;
  end if;

  -- Todo lo que nació de esta cotización pasa al cliente correcto.
  update public.cotizaciones set contacto_id = nuevo, updated_at = now() where id = cot.id;
  update public.proyectos    set contacto_id = nuevo where cotizacion_id = cot.id;
  update public.ventas       set contacto_id = nuevo where cotizacion_id = cot.id;
  update public.contratos    set contacto_id = nuevo where cotizacion_id = cot.id;

  raise notice 'COT-0093 ahora ligada al contacto %', nuevo;
end $$;

-- PASO 3 — revisar (debe salir el nombre correcto en las 3 filas)
select 'cotizacion' as de, c.folio as ref, k.nombre, k.email from public.cotizaciones c join public.contactos k on k.id = c.contacto_id where c.folio = 'COT-0093'
union all
select 'proyecto', p.titulo, k.nombre, k.email from public.proyectos p join public.cotizaciones c on c.id = p.cotizacion_id join public.contactos k on k.id = p.contacto_id where c.folio = 'COT-0093'
union all
select 'venta', v.id::text, k.nombre, k.email from public.ventas v join public.cotizaciones c on c.id = v.cotizacion_id join public.contactos k on k.id = v.contacto_id where c.folio = 'COT-0093';
