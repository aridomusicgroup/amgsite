-- REAPER deja de estar amarrado a un solo correo.
--
-- Las tres tablas del módulo tenían la política pegada a
-- 'djrochaoerre@gmail.com', así que ni el otro socio podía verlo y darle acceso
-- a alguien más requería tocar código y correr SQL. Ahora quién entra lo decide
-- el sistema de módulos del panel (igual que el resto), y la RLS sólo distingue
-- staff de no-staff — que es lo único que Postgres puede saber por sí solo.
--
-- Estas políticas gobiernan la SUSCRIPCIÓN EN TIEMPO REAL del navegador. Las
-- páginas y las rutas de API leen con service role y se protegen con
-- requireModule('/admin/dev-logs').

drop policy if exists dev_rt_read on public.reaper_sync_logs;
create policy staff_rt_read on public.reaper_sync_logs for select to authenticated
  using (public.is_staff());

drop policy if exists dev_rt_read on public.render_jobs;
create policy staff_rt_read on public.render_jobs for select to authenticated
  using (public.is_staff());

drop policy if exists dev_inv_read on public.render_inventario;
create policy staff_rt_read on public.render_inventario for select to authenticated
  using (public.is_staff());
