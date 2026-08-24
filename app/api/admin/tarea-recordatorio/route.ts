import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validarRecordar } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mi recordatorio en una tarea. Entra cualquiera del equipo con sesión: es una
 * nota para uno mismo, no una edición del proyecto.
 *
 * El dueño SIEMPRE sale de la sesión, nunca del cuerpo de la petición. Si
 * viniera del navegador, cualquiera podría ponerle recordatorios a otro (o
 * borrarle los suyos) mandando otro correo a mano.
 */

const SIN_TABLA = "Falta correr supabase-recordatorios.sql en Supabase.";
const SIN_COLUMNA = "Falta correr supabase-recordatorio-para.sql en Supabase.";

type Para = "yo" | "responsable" | "ambos";
const PARA: Para[] = ["yo", "responsable", "ambos"];

/**
 * A quién va el recordatorio.
 *
 * El correo del responsable lo resuelve el SERVIDOR desde la tarea; nunca se
 * acepta un correo del navegador. Así se puede avisar a quien tiene la tarea
 * sin abrir la puerta a mandarle recordatorios a cualquiera.
 */
async function destinatarios(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  tareaId: string,
  para: Para,
  miEmail: string,
): Promise<{ emails: string[]; error?: string }> {
  if (para === "yo") return { emails: [miEmail] };

  const { data: t } = await sb
    .from("proyecto_tareas")
    .select("responsable_id")
    .eq("id", tareaId)
    .single();
  if (!t?.responsable_id) {
    return { emails: [], error: "Esa tarea no tiene responsable asignado." };
  }

  const { data: p } = await sb.from("equipo").select("email, nombre").eq("id", t.responsable_id).single();
  const suyo = String(p?.email || "").toLowerCase();
  if (!suyo) {
    return { emails: [], error: `${p?.nombre || "El responsable"} no tiene correo en su ficha del equipo.` };
  }

  const lista = para === "ambos" ? [miEmail, suyo] : [suyo];
  return { emails: [...new Set(lista)] };
}

/** Pone o actualiza un recordatorio. Uno por tarea por persona. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tareaId = String(b.tarea_id || "").trim();
  const recordarAt = String(b.recordar_at || "").trim();
  const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 500) : null;
  const para: Para = PARA.includes(b.para) ? b.para : "yo";
  if (!tareaId) return NextResponse.json({ error: "Falta la tarea." }, { status: 400 });

  const problema = validarRecordar(recordarAt);
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  const sb = supabaseAdmin();
  // Que la tarea exista de verdad: sin esto se podrían sembrar recordatorios
  // colgando de ids inventados que el cron intentaría mandar cada 5 minutos.
  const { data: t } = await sb.from("proyecto_tareas").select("id").eq("id", tareaId).single();
  if (!t) return NextResponse.json({ error: "Esa tarea ya no existe." }, { status: 404 });

  const mio = s.email.toLowerCase();
  const { emails, error: errDest } = await destinatarios(sb, tareaId, para, mio);
  if (errDest) return NextResponse.json({ error: errDest }, { status: 400 });

  // Nunca pisar el recordatorio que alguien se puso A SÍ MISMO: puede tenerlo a
  // otra hora por sus propias razones. Solo se toca el propio o el que uno mismo
  // le colocó antes.
  const { data: previos } = await sb
    .from("tarea_recordatorios")
    .select("email, puesto_por, recordar_at")
    .eq("tarea_id", tareaId)
    .in("email", emails);

  const intocables = new Set(
    (previos ?? [])
      .filter((r: { email: string; puesto_por: string | null }) => {
        const dueno = String(r.email).toLowerCase();
        return dueno !== mio && String(r.puesto_por || dueno).toLowerCase() === dueno;
      })
      .map((r: { email: string }) => String(r.email).toLowerCase()),
  );

  const aGuardar = emails.filter((e) => !intocables.has(e));
  if (aGuardar.length === 0) {
    return NextResponse.json({ ok: true, guardados: 0, respetados: [...intocables] });
  }

  const { error } = await sb.from("tarea_recordatorios").upsert(
    aGuardar.map((email) => ({
      tarea_id: tareaId,
      email,
      recordar_at: new Date(recordarAt).toISOString(),
      nota: nota || null,
      puesto_por: mio,
      // Mover la hora REACTIVA el recordatorio: si ya se había mandado y la
      // persona la recorre, tiene que volver a sonar.
      enviado_at: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "tarea_id,email" },
  );
  if (error) {
    if (/puesto_por/i.test(error.message)) {
      return NextResponse.json({ error: SIN_COLUMNA }, { status: 503 });
    }
    const falta = /relation .* does not exist|schema cache/i.test(error.message);
    return NextResponse.json({ error: falta ? SIN_TABLA : error.message }, { status: falta ? 503 : 500 });
  }

  // Se devuelve a QUIÉN se guardó de verdad: el responsable lo resuelve el
  // servidor contra la base, así que puede no ser el que la pantalla mostraba.
  return NextResponse.json({ ok: true, guardados: aGuardar.length, emails: aGuardar, respetados: [...intocables] });
}

/**
 * Quita el mío y, si lo pido, el que YO le puse al responsable.
 *
 * El que otro se puso a sí mismo nunca se toca: por eso el borrado del ajeno
 * lleva `puesto_por = yo`.
 */
export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tareaId = String(b.tarea_id || "").trim();
  const para: Para = PARA.includes(b.para) ? b.para : "yo";
  if (!tareaId) return NextResponse.json({ error: "Falta la tarea." }, { status: 400 });

  const sb = supabaseAdmin();
  const mio = s.email.toLowerCase();

  if (para === "yo" || para === "ambos") {
    const { error } = await sb
      .from("tarea_recordatorios")
      .delete()
      .eq("tarea_id", tareaId)
      .eq("email", mio);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (para === "responsable" || para === "ambos") {
    const { emails } = await destinatarios(sb, tareaId, "responsable", mio);
    const suyo = emails.find((e) => e !== mio);
    if (suyo) {
      await sb
        .from("tarea_recordatorios")
        .delete()
        .eq("tarea_id", tareaId)
        .eq("email", suyo)
        .eq("puesto_por", mio);
    }
  }

  return NextResponse.json({ ok: true });
}
