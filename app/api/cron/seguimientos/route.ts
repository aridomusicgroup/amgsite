import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAResponsables } from "@/lib/push";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hasta cuántos días de vencido se sigue empujando un seguimiento. */
const DIAS_VENTANA = 7;

/**
 * Recordatorio diario de seguimientos del CRM.
 *
 * Manda UN solo push agrupado con lo que toca hoy y lo que ya venció — no uno
 * por lead, que se volvería ruido y la gente apagaría las notificaciones.
 *
 * Lo dispara el cron de Vercel (ver vercel.json). Autorización: en producción
 * Vercel manda el header `Authorization: Bearer $CRON_SECRET`; también se acepta
 * una sesión de admin para poder probarlo a mano desde el panel.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_VENTANA);
  const limite = desde.toISOString().slice(0, 10);

  const { data: todos, error } = await sb
    .from("contactos")
    .select("id, nombre, proxima_accion, proxima_fecha")
    .is("merged_into", null)
    .not("proxima_fecha", "is", null)
    .lte("proxima_fecha", hoy)
    .order("proxima_fecha", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Solo se avisa de lo vencido RECIENTE. Un seguimiento que lleva semanas
  // colgado ya no se va a atender por verlo un día más en el push: solo engorda
  // el aviso hasta que se ignora entero. Sigue visible en la lista de Clientes.
  const pend = (todos ?? []).filter((c) => (c.proxima_fecha as string) >= limite);
  const viejos = (todos ?? []).length - pend.length;

  if (pend.length === 0) return NextResponse.json({ ok: true, pendientes: 0, viejos });

  const vencidos = pend.filter((c) => (c.proxima_fecha as string) < hoy).length;
  const deHoy = pend.length - vencidos;

  const partes: string[] = [];
  if (deHoy > 0) partes.push(`${deHoy} para hoy`);
  if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos === 1 ? "" : "s"}`);

  // El primero da contexto concreto; el resto va como conteo.
  const primero = pend[0];
  const base = primero.nombre
    ? `${primero.nombre}: ${primero.proxima_accion ?? "dar seguimiento"}`
    : (primero.proxima_accion ?? "dar seguimiento");
  // Los viejos se mencionan aunque no se persigan: esconderlos sin decirlo haría
  // creer que la lista está limpia.
  const ejemplo = viejos > 0 ? `${base} · (+${viejos} sin tocar hace rato)` : base;

  // Sin dueño por contacto: avisa a quien trabaja el CRM (admin + crm).
  const correos = [...new Set([...adminEmails(), ...crmEmails()].map((e) => e.toLowerCase()))];
  const { data: eq } = await sb.from("equipo").select("id, email").eq("activo", true);
  const ids = (eq ?? [])
    .filter((p) => p.email && correos.includes(String(p.email).toLowerCase()))
    .map((p) => p.id as string);

  // Si es uno solo, se abre ESE contacto con su línea de tiempo; si son varios,
  // la lista ya filtrada a "toca hoy". Antes caía en la lista completa.
  const url =
    pend.length === 1
      ? `https://admin.aridomusicgroup.com/admin/clientes?destacar=${primero.id}`
      : "https://admin.aridomusicgroup.com/admin/clientes?foco=toca";

  await pushAResponsables(sb, ids, {
    titulo: `📞 Seguimientos: ${partes.join(" · ")}`,
    cuerpo: ejemplo,
    url,
  });

  return NextResponse.json({ ok: true, pendientes: pend.length, vencidos, deHoy, viejos, avisados: ids.length });
}
