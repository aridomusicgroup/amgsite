import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAEmails } from "@/lib/push";
import { recordatorioTareaEmail } from "@/lib/emails";
import { fechaLarga } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Árido Music Group <pedidos@aridomusicgroup.com>";
const SITE = "https://admin.aridomusicgroup.com";
/** Tope por pasada: si algo se acumula, se drena en las siguientes. */
const LOTE = 50;

interface FilaRecordatorio {
  id: string;
  tarea_id: string;
  email: string;
  recordar_at: string;
  nota: string | null;
  /** Ausente mientras no se corra supabase-recordatorio-para.sql. */
  puesto_por?: string | null;
}

/**
 * Dispara los recordatorios de tarea que ya vencieron: push al panel + correo.
 *
 * Corre cada 5 minutos (ver vercel.json), así que un recordatorio puesto a las
 * 9:00 llega entre 9:00 y 9:05. No se persigue el segundo exacto: costaría un
 * cron por minuto y nadie nota la diferencia en un recordatorio de trabajo.
 *
 * Se marca `enviado_at` SIEMPRE, aunque falle el correo. Si no, el mismo
 * recordatorio se reintentaría cada 5 minutos para siempre — y el día que
 * Resend tenga un mal rato, la persona amanecería con 200 correos iguales. El
 * push va primero justamente por eso: es el aviso que sí llega aunque el correo
 * no salga.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const ahora = new Date().toISOString();

  // `puesto_por` llegó después que la tabla. Si todavía no se corre el SQL, se
  // pide sin esa columna en vez de tronar: dejar a todo el equipo sin
  // recordatorios por una columna nueva sería peor que perder el "te lo puso X".
  const columnas = "id, tarea_id, email, recordar_at, nota";
  // El `select` con string dinámico rompe la inferencia de Supabase, así que la
  // forma de la fila se declara aquí.
  const consulta = async (cols: string) => {
    const r = await sb.from("tarea_recordatorios")
      .select(cols)
      .is("enviado_at", null)
      .lte("recordar_at", ahora)
      .order("recordar_at", { ascending: true })
      .limit(LOTE);
    return { data: r.data as unknown as FilaRecordatorio[] | null, error: r.error };
  };

  let { data: pend, error } = await consulta(`${columnas}, puesto_por`);
  if (error && /puesto_por/i.test(error.message)) {
    ({ data: pend, error } = await consulta(columnas));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pend?.length) return NextResponse.json({ ok: true, disparados: 0 });

  const tareaIds = [...new Set(pend.map((r) => r.tarea_id as string))];
  const [{ data: tareas }, { data: subs }, { data: eq }] = await Promise.all([
    sb.from("proyecto_tareas")
      .select("id, titulo, notas, fecha, responsable_id, proyectos(titulo, folio, contactos(nombre))")
      .in("id", tareaIds),
    sb.from("proyecto_subtareas").select("tarea_id, titulo, hecho").in("tarea_id", tareaIds),
    sb.from("equipo").select("id, nombre, email"),
  ]);

  const porId = new Map((tareas ?? []).map((t) => [t.id as string, t]));
  const pendientesPorTarea = new Map<string, string[]>();
  for (const s of subs ?? []) {
    if (s.hecho) continue;
    const tid = s.tarea_id as string;
    pendientesPorTarea.set(tid, [...(pendientesPorTarea.get(tid) ?? []), s.titulo as string]);
  }
  const nombrePorId = new Map((eq ?? []).map((e) => [e.id as string, e.nombre as string]));
  const nombrePorEmail = new Map(
    (eq ?? []).filter((e) => e.email).map((e) => [String(e.email).toLowerCase(), e.nombre as string]),
  );

  const key = process.env.RESEND_API_KEY;
  const resend = key ? new Resend(key) : null;
  let correos = 0;

  for (const r of pend) {
    const t = porId.get(r.tarea_id as string);
    // La tarea pudo borrarse entre que se puso el recordatorio y ahora. El
    // `on delete cascade` se lleva la fila, pero por si acaso: no se avisa de
    // algo que ya no existe.
    if (!t) continue;

    // Supabase devuelve la relación como objeto o arreglo según la inferencia.
    const proyRaw = (t as { proyectos?: unknown }).proyectos;
    const proy = (Array.isArray(proyRaw) ? proyRaw[0] : proyRaw) as
      | { titulo?: string; folio?: string; contactos?: { nombre?: string } | { nombre?: string }[] }
      | undefined;
    const contRaw = proy?.contactos;
    const cont = (Array.isArray(contRaw) ? contRaw[0] : contRaw) as { nombre?: string } | undefined;

    const proyecto = proy?.titulo ?? null;
    const folio = proy?.folio ?? null;
    const titulo = t.titulo as string;
    const pendientes = pendientesPorTarea.get(r.tarea_id as string) ?? [];
    // Al tocar el push se abre ESA tarea, no el tablero entero.
    const url = `${SITE}/admin/produccion?destacar=${r.tarea_id as string}`;
    const email = String(r.email);

    // ¿Se lo puso alguien más? Cambia el texto: no es lo mismo un recordatorio
    // que uno se puso solo que uno que le dejó un compañero.
    const puestoPor = String(r.puesto_por || email).toLowerCase();
    const ajeno = puestoPor !== email.toLowerCase();
    const deQuien = ajeno ? nombrePorEmail.get(puestoPor) ?? puestoPor : null;

    // 1) Push primero: es el que llega aunque el correo falle.
    await pushAEmails(sb, [email], {
      titulo: `⏰ ${titulo}`,
      cuerpo:
        [proyecto, r.nota as string | null, deQuien ? `— de ${deQuien}` : null]
          .filter(Boolean)
          .join(" · ") || (deQuien ? `Recordatorio de ${deQuien}` : "Recordatorio de tu tarea"),
      url,
    });

    // 2) Correo con todo el contexto.
    if (resend) {
      try {
        const mail = recordatorioTareaEmail({
          paraNombre: nombrePorEmail.get(email.toLowerCase())?.split(" ")[0] ?? null,
          tarea: titulo,
          proyecto,
          folio,
          cliente: cont?.nombre ?? null,
          fechaTarea: t.fecha ? new Date(`${t.fecha}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) : null,
          responsable: t.responsable_id ? nombrePorId.get(t.responsable_id as string) ?? null : null,
          notasTarea: (t.notas as string | null) ?? null,
          notaRecordatorio: (r.nota as string | null) ?? null,
          pendientes,
          cuando: fechaLarga(r.recordar_at as string),
          url,
          dePartede: deQuien,
        });
        await resend.emails.send({ from: FROM, to: [email], subject: mail.subject, html: mail.html });
        correos++;
      } catch {
        /* el push ya salió; se sella igual para no reintentar en bucle */
      }
    }

    await sb
      .from("tarea_recordatorios")
      .update({ enviado_at: new Date().toISOString() })
      .eq("id", r.id as string);
  }

  return NextResponse.json({ ok: true, disparados: pend.length, correos });
}
