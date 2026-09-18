import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accesoVigente, hoyMx, leerConfig } from "@/lib/cursos-tipos";
import { enviarCorreo, mentoriaVenceEmail, sesionHoyEmail } from "@/lib/emails-cursos";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIA = 86_400_000;
const login = (ruta: string) => `${DOMAINS.main}/cuenta/login?siguiente=${encodeURIComponent(ruta)}`;

/**
 * Cron diario (9 am CDMX) de la mentoría:
 *  1. A quien se le vence el acceso en ~3 días, un correo para renovar.
 *  2. Si hoy hay sesión en vivo, un correo a todos los miembros vigentes.
 * Mientras la mentoría no tenga miembros, no manda nada.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: mentorias, error } = await sb.from("cursos").select("id, titulo").eq("tipo", "mentoria");
  if (error || !mentorias?.length) return NextResponse.json({ ok: true, mentorias: 0 });

  // El curso que liga cada mentoría (de ahí sale el botón para pagar el mes).
  const { data: cursos } = await sb.from("cursos").select("id, config").eq("tipo", "curso");
  const origenDe = new Map<string, string>();
  for (const c of cursos ?? []) {
    const m = leerConfig(c.config).mentoria;
    if (m.curso_id) origenDe.set(m.curso_id, c.id as string);
  }

  const ahora = Date.now();
  const hoy = hoyMx();
  let avisosVence = 0;
  let avisosSesion = 0;

  for (const m of mentorias) {
    const { data: accesos } = await sb.from("curso_accesos").select("email, vence_en").eq("curso_id", m.id);
    const vigentes = (accesos ?? []).filter((a) => accesoVigente(a.vence_en as string | null));
    const origen = origenDe.get(m.id as string);

    // 1) Vence entre 2 y 3 días a partir de ahora: una sola vez por ciclo.
    for (const a of vigentes) {
      const v = a.vence_en ? Date.parse(a.vence_en as string) : null;
      if (v == null || v < ahora + 2 * DIA || v >= ahora + 3 * DIA) continue;
      const fecha = new Date(v).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });
      if (await enviarCorreo(a.email as string, mentoriaVenceEmail({ nombre: null, fecha, urlPago: origen ? login(`/cuenta/curso/${origen}`) : null }))) avisosVence++;
    }

    // 2) Sesiones en vivo de HOY (hora de México).
    const { data: mods } = await sb.from("curso_modulos").select("id").eq("curso_id", m.id);
    const modIds = (mods ?? []).map((x) => x.id as string);
    if (!modIds.length || !vigentes.length) continue;
    const { data: sesiones } = await sb.from("curso_lecciones").select("id, titulo, contenido").in("modulo_id", modIds).eq("tipo", "en_vivo").eq("publicada", true);
    for (const s of sesiones ?? []) {
      const iso = (s.contenido as { fecha_hora?: string } | null)?.fecha_hora;
      if (!iso || hoyMx(new Date(iso)) !== hoy) continue;
      const hora = new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
      const url = login(`/cuenta/curso/${m.id}/leccion/${s.id}`);
      for (const a of vigentes) {
        if (await enviarCorreo(a.email as string, sesionHoyEmail({ titulo: s.titulo as string, hora, url }))) avisosSesion++;
      }
    }
  }

  return NextResponse.json({ ok: true, avisosVence, avisosSesion });
}
