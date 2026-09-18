import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accesoVigente, hoyMx, leerConfig } from "@/lib/cursos-tipos";
import { enviarCorreo, enviarMasivo, mentoriaVenceEmail, preventaCierraEmail, sesionHoyEmail } from "@/lib/emails-cursos";
import { correosConAcceso, listaAvisame, ventaDeCurso } from "@/lib/curso-preventa";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIA = 86_400_000;
const login = (ruta: string) => `${DOMAINS.main}/cuenta/login?siguiente=${encodeURIComponent(ruta)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Cron diario (9 am CDMX) de Cursos:
 *  1. Mentoría: a quien se le vence el acceso en ~3 días, un correo para renovar.
 *  2. Mentoría: si hoy hay sesión en vivo, un correo a todos los miembros vigentes.
 *  3. Preventa: 2 días antes del cierre, recordatorio a la lista Avísame.
 * Sin mentoría con miembros ni preventa con fecha de cierre, no manda nada.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const [mentoria, avisosCierre] = await Promise.all([avisosMentoria(sb), avisosPreventa(sb)]);
  return NextResponse.json({ ok: true, ...mentoria, avisosCierre });
}

/** 2 días antes de que cierre una preventa: “se acaba el precio de fundador”. */
async function avisosPreventa(sb: SB): Promise<number> {
  const { data: cursos } = await sb.from("cursos").select("id, slug, titulo, tipo, activo, precio_mxn, config").eq("activo", true);
  let enviados = 0;
  for (const c of cursos ?? []) {
    const cierre = leerConfig(c.config).preventa.cierre;
    if (c.tipo === "mentoria" || !cierre) continue;
    const v = await ventaDeCurso(sb, c);
    if (v.estado !== "preventa" || v.diasParaCierre !== 2 || !v.precio) continue;
    const [lista, conAcceso] = await Promise.all([listaAvisame(sb, c.id), correosConAcceso(sb, c.id)]);
    const yaCompraron = new Set(conAcceso);
    enviados += await enviarMasivo(
      lista.filter((e) => !yaCompraron.has(e)),
      preventaCierraEmail({ curso: c.titulo, slug: c.slug, precio: v.precio, regular: v.precioRegular, cierre }),
      `cierre-${c.id}-${cierre}`,
    );
  }
  return enviados;
}

async function avisosMentoria(sb: SB): Promise<{ avisosVence: number; avisosSesion: number }> {
  const { data: mentorias, error } = await sb.from("cursos").select("id, titulo").eq("tipo", "mentoria");
  if (error || !mentorias?.length) return { avisosVence: 0, avisosSesion: 0 };

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
    const vigentes = ((accesos ?? []) as { email: string; vence_en: string | null }[]).filter((a) => accesoVigente(a.vence_en as string | null));
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
    const modIds = ((mods ?? []) as { id: string }[]).map((x) => x.id);
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

  return { avisosVence, avisosSesion };
}
