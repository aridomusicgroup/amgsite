import { NextRequest, NextResponse } from "next/server";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionDeMusico } from "@/lib/musico-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { pushAResponsables, pushAEmails, destinoProyecto, destinoProyectoTab, conProyecto } from "@/lib/push";
import { adminEmails } from "@/lib/supabase/auth-server";
import { rateLimit } from "@/lib/rate-limit";
import { efectosDeTareaCompletada } from "@/lib/tarea-completar";
import { entregaTrasPalomear, entregaParaQuienPalomeo } from "@/lib/entrega";
import { avanzarEstadoPorTareas } from "@/lib/estado-auto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLASES = ["previo", "stem"] as const;
const MAX_NOMBRE = 200;

/**
 * Registra lo que el músico acaba de subir a Drive y avisa al equipo.
 *
 * A diferencia del portal de clientes —donde este paso es un aviso y ya— aquí
 * es la pieza central: es lo que crea la fila de `musico_archivos`, que es lo
 * que hace que `reaper-sync` baje la pista y que aparezca el botón de aprobar
 * el previo. Sin esta llamada el archivo existe en Drive y para nadie más.
 *
 * El archivo NO se comparte con el cliente aquí. Un previo entra sin aprobar; la
 * puerta al cliente es `render_jobs.compartir`, y eso lo prende una persona del
 * estudio desde el panel.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const musicoId = await getMusicoId();
  if (!musicoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`musubida:${musicoId}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const asig = await asignacionDeMusico(musicoId, id);
  if (!asig) return NextResponse.json({ error: "Esa asignación no es tuya." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const clase = String(b.clase || "");
  const nombre = String(b.nombre || "").trim().slice(0, MAX_NOMBRE);
  const driveId = String(b.driveId || "").trim();
  const bytes = Number(b.bytes);
  // A qué canal va. Lo elige el músico con el botón, no se deduce del orden.
  const slot = Math.min(Math.max(0, Math.trunc(Number(b.slot) || 0)), 9);

  if (!(CLASES as readonly string[]).includes(clase)) {
    return NextResponse.json({ error: "Tipo de archivo desconocido." }, { status: 400 });
  }
  if (!nombre || !driveId) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  // Mismo criterio que el portal: un previo que no sea mp3 no se puede
  // reproducir en el panel del cliente, y una pista que no sea wav no sirve
  // para mezclar. Se revalida aquí porque la del navegador es una comodidad.
  if (clase === "previo" && !/\.mp3$/i.test(nombre)) {
    return NextResponse.json({ error: "El previo tiene que ser un MP3." }, { status: 400 });
  }
  if (clase === "stem" && !/\.wav$/i.test(nombre)) {
    return NextResponse.json({ error: "La pista tiene que ser un WAV." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("musico_archivos").insert({
    asignacion_id: asig.id,
    clase,
    nombre,
    drive_id: driveId,
    slot: clase === "stem" ? slot : 0,
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Una pista entregada mueve la asignación; un previo es un avance, no la entrega.
  if (clase === "stem") {
    await sb.from("musico_asignaciones")
      .update({ estado: "entregado", updated_at: new Date().toISOString() })
      .eq("id", asig.id);
  }

  // Con la última pista que se le pidió (Charchetas son dos: L y R), su tarea
  // "Grabar X" queda hecha sola, igual que si alguien la palomeara en el
  // tablero. Una pista de más o un reemplazo ya no la vuelve a tocar.
  const completada = clase === "stem" && asig.tareaId
    ? await completarTareaDelMusico(sb, { asignacionId: asig.id, tareaId: asig.tareaId, instrumento: asig.instrumento, musico })
    : null;

  const { data: proy } = await sb.from("proyectos")
    .select("titulo, responsables, responsable_id")
    .eq("id", asig.proyectoId)
    .maybeSingle();

  const que = clase === "previo" ? "un previo" : `su pista de ${asig.instrumento}`;
  const texto = `${musico.nombre} subió ${que}`;

  await registrarActividad(sb, {
    tipo: "musico_archivo",
    titulo: texto,
    actor: musico.email ?? null,
    proyecto_id: asig.proyectoId,
    tarea_id: asig.tareaId,
    // Sin `entidad` a propósito: "musico" está en ENTIDADES_SENSIBLES (por los
    // pagos), y marcarlo así escondería este aviso justo de Diego y Leo, que
    // son quienes tienen que enterarse. Con proyecto_id basta para que caiga en
    // la bitácora de Producción.
    meta: { clase, nombre, instrumento: asig.instrumento, musico: musico.nombre },
  });

  const responsables = [
    ...(((proy?.responsables as string[] | null) ?? []) as string[]),
    (proy?.responsable_id as string | null) ?? null,
  ];

  /*
   * Un previo pide una DECISIÓN; una pista es sólo una noticia.
   *
   * El previo se queda parado hasta que alguien le da el visto bueno, así que el
   * aviso tiene que decir eso y llevar al botón, no al tablero. Y va también a
   * los admins: el único responsable de EL NECIO era otra persona, y el previo de
   * Martín se quedó esperando sin que se enterara nadie que pudiera aprobarlo.
   *
   * Los correos se juntan en UNA sola lista antes de mandar. Con dos llamadas
   * separadas, un admin que además sea responsable recibiría la notificación dos
   * veces: cada llamada deduplica por dentro, pero no entre ellas.
   */
  const esPrevio = clase === "previo";
  const msg = {
    titulo: "ARIDO · Producción",
    cuerpo: conProyecto(
      (proy?.titulo as string | null) ?? null,
      esPrevio
        ? `${texto} — falta tu visto bueno para que lo oiga el cliente`
        : completada ? `${texto} — “${completada}” quedó completa ✅` : texto,
    ),
    url: esPrevio ? destinoProyectoTab(asig.proyectoId, "produccion") : destinoProyecto(asig.proyectoId),
  };

  if (!esPrevio) {
    await pushAResponsables(sb, responsables, msg);
  } else {
    const ids = [...new Set(responsables.filter((x): x is string => Boolean(x)))];
    const { data: eq } = ids.length
      ? await sb.from("equipo").select("email").in("id", ids)
      : { data: [] as { email: string | null }[] };
    const correos = [
      ...(eq ?? []).map((r: { email: string | null }) => r.email),
      ...adminEmails(),
    ];
    await pushAEmails(sb, correos, msg);
  }

  return NextResponse.json({ ok: true, completada });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * ¿Ya llegaron todas las pistas que se le piden? Una por canal del instrumento
 * (`instrumento_pistas.canales`, p. ej. Charchetas = "L, R"); sin canales, una.
 * Mismo criterio que los botones del portal (`SubirParte`): hueco 0..n-1.
 */
async function pistasCompletas(sb: SB, asignacionId: string, instrumento: string): Promise<boolean> {
  const [{ data: mapa }, { data: stems }] = await Promise.all([
    sb.from("instrumento_pistas").select("instrumento, canales"),
    sb.from("musico_archivos").select("slot").eq("asignacion_id", asignacionId).eq("clase", "stem"),
  ]);
  const fila = ((mapa ?? []) as { instrumento: string; canales: string | null }[])
    .find((m) => norm(String(m.instrumento)) === norm(instrumento));
  const canales = String(fila?.canales ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const pedidos = Math.max(1, canales.length);
  const llegaron = new Set(((stems ?? []) as { slot: number | null }[]).map((s) => Number(s.slot) || 0));
  for (let i = 0; i < pedidos; i++) if (!llegaron.has(i)) return false;
  return true;
}

/**
 * Palomea la tarea del músico cuando ya mandó todas sus pistas. Devuelve el
 * título de lo que quedó completo, o null si todavía falta algo o ya estaba.
 *
 * En un EP la asignación cuelga del TEMA, no de "Grabar X": ahí se palomea la
 * subtarea "Grabar {instrumento}" de ese tema, nunca el tema entero.
 */
async function completarTareaDelMusico(
  sb: SB,
  d: { asignacionId: string; tareaId: string; instrumento: string; musico: { nombre: string; email: string | null } },
): Promise<string | null> {
  try {
    if (!(await pistasCompletas(sb, d.asignacionId, d.instrumento))) return null;
    const actor = d.musico.email ?? "portal-musicos";
    const { data: t } = await sb.from("proyecto_tareas")
      .select("id, titulo, hecho, proyecto_id, visible_cliente, es_cancion").eq("id", d.tareaId).maybeSingle();
    if (!t) return null;

    if (t.es_cancion) {
      const { data: subs } = await sb.from("proyecto_subtareas").select("id, titulo, hecho").eq("tarea_id", t.id);
      const sub = ((subs ?? []) as { id: string; titulo: string; hecho: boolean }[])
        .find((s) => !s.hecho && norm(s.titulo) === norm(`Grabar ${d.instrumento}`));
      if (!sub) return null;
      const { data: hecha } = await sb.from("proyecto_subtareas")
        .update({ hecho: true }).eq("id", sub.id).eq("hecho", false).select("id");
      if (!hecha?.length) return null;
      if (t.proyecto_id) await avanzarEstadoPorTareas(sb, t.proyecto_id as string, actor);
      await entregaParaQuienPalomeo(sb, await entregaTrasPalomear(sb, { subtareaId: sub.id }));
      return `${sub.titulo} · ${t.titulo}`;
    }

    if (t.hecho) return null;
    // `.eq("hecho", false)`: si alguien la palomeó en este mismo instante, no se repiten los avisos.
    const { data: hecha } = await sb.from("proyecto_tareas")
      .update({ hecho: true, completado_at: new Date().toISOString() })
      .eq("id", t.id).eq("hecho", false).select("id");
    if (!hecha?.length) return null;

    await efectosDeTareaCompletada(sb, {
      tareaId: t.id as string,
      proyectoId: (t.proyecto_id as string | null) ?? null,
      titulo: t.titulo as string,
      visibleCliente: (t.visible_cliente as boolean | null) ?? null,
      actor,
    });
    await registrarActividad(sb, {
      tipo: "tarea_completada",
      titulo: `“${t.titulo}” quedó completa: ${d.musico.nombre} mandó sus pistas ✅`,
      actor: d.musico.email ?? null,
      proyecto_id: (t.proyecto_id as string | null) ?? null,
      tarea_id: t.id as string,
    });
    return t.titulo as string;
  } catch (e) {
    // La pista ya quedó registrada; no palomear la tarea no debe tumbar la subida.
    console.error("completar-tarea-musico:", e);
    return null;
  }
}
