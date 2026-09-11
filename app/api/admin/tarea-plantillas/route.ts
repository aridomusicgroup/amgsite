import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esPaso, pasoDeTitulo, PASO_LABEL } from "@/lib/pasos-entrega";

export const dynamic = "force-dynamic";

/**
 * Qué tareas nacen con cada tipo de proyecto.
 *
 * Hasta hoy vivían en un switch del código con sólo 4 casos; los otros 8 tipos
 * nacían sin ninguna tarea. Esto las hace editables sin tocar código.
 *
 * Ojo con la fila `clase = 'instrumentos'`: es el HUECO donde se expanden las
 * tareas "Grabar X" de los instrumentos vendidos, en el lugar donde se puso —
 * en un beat personalizado van entre la maqueta y la edición, no al final.
 */

const MAX_ITEMS = 60;
const MAX_SUBS = 30;
const MAX_TEXTO = 200;

interface ItemEntrada {
  clase?: string;
  titulo?: string;
  resp?: string | null;
  responsable_id?: string | null;
  subs?: unknown;
  paso?: unknown;
}

export async function GET() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = supabaseAdmin();

  const items = (cols: string) => sb.from("tarea_plantilla_items").select(cols).order("tipo").order("orden");
  const [itemsConPaso, eqRes] = await Promise.all([
    items("tipo, orden, clase, titulo, resp, responsable_id, subs, paso"),
    sb.from("equipo").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  // `paso` es columna nueva (supabase-pasos-entrega.sql): sin ella se pide sin ella.
  const itemsRes = itemsConPaso.error
    ? await items("tipo, orden, clase, titulo, resp, responsable_id, subs")
    : itemsConPaso;

  // La migración la corre una persona a mano. Sin tabla, la pantalla dice que
  // todo sigue usando la plantilla de fábrica; no se rompe.
  if (itemsRes.error) {
    return NextResponse.json({ plantillas: {}, equipo: eqRes.data ?? [], sinTabla: true });
  }

  const plantillas: Record<string, ItemEntrada[]> = {};
  for (const f of (itemsRes.data ?? []) as unknown as Record<string, unknown>[]) {
    const t = f.tipo as string;
    (plantillas[t] ??= []).push({
      clase: (f.clase as string) ?? "tarea",
      titulo: f.titulo as string,
      resp: (f.resp as string | null) ?? null,
      responsable_id: (f.responsable_id as string | null) ?? null,
      subs: (f.subs as string[] | null) ?? [],
      // Sin marca guardada (antes de la migración), se reconoce por el título.
      paso: esPaso(f.paso) ? f.paso : pasoDeTitulo(f.titulo as string),
    });
  }

  return NextResponse.json({ plantillas, equipo: eqRes.data ?? [], sinTabla: false });
}

/** POST: guarda la plantilla COMPLETA de un tipo (reemplaza lo que hubiera). */
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tipo = String(b.tipo || "").trim().slice(0, 60);
  if (!tipo) return NextResponse.json({ error: "Falta el tipo." }, { status: 400 });
  if (!Array.isArray(b.items)) return NextResponse.json({ error: "Faltan las tareas." }, { status: 400 });
  if (b.items.length > MAX_ITEMS) return NextResponse.json({ error: `Máximo ${MAX_ITEMS} tareas.` }, { status: 400 });

  const items: ItemEntrada[] = [];
  let huecos = 0;
  const pasosVistos = new Set<string>();
  for (const raw of b.items as ItemEntrada[]) {
    const clase = raw?.clase === "instrumentos" ? "instrumentos" : "tarea";
    const paso = clase === "tarea" && esPaso(raw?.paso) ? raw.paso : null;
    if (paso) {
      // Dos "Subir a Drive" marcados: ¿cuál palomea la entrega? Mejor decirlo.
      if (pasosVistos.has(paso)) {
        return NextResponse.json({ error: `Sólo puede haber un paso de ${PASO_LABEL[paso]}.` }, { status: 400 });
      }
      pasosVistos.add(paso);
    }
    const titulo = String(raw?.titulo ?? "").trim().slice(0, MAX_TEXTO);
    if (clase === "instrumentos") {
      huecos += 1;
      // Sin el marcador no habría dónde poner los instrumentos y la tarea diría
      // literalmente "Grabar {instrumento}" en el tablero.
      if (!titulo.includes("{instrumento}")) {
        return NextResponse.json({ error: "El patrón de instrumentos tiene que incluir {instrumento}." }, { status: 400 });
      }
    } else if (!titulo) {
      return NextResponse.json({ error: "Hay una tarea sin título." }, { status: 400 });
    }
    const subs = Array.isArray(raw?.subs)
      ? (raw.subs as unknown[]).map((s) => String(s).trim().slice(0, MAX_TEXTO)).filter(Boolean).slice(0, MAX_SUBS)
      : [];
    items.push({
      clase,
      titulo: titulo || "Grabar {instrumento}",
      resp: String(raw?.resp ?? "").trim() || null,
      responsable_id: String(raw?.responsable_id ?? "").trim() || null,
      subs,
      paso,
    });
  }
  // Dos huecos duplicarían cada tarea "Grabar X" en el proyecto.
  if (huecos > 1) return NextResponse.json({ error: "Sólo puede haber un lugar para los instrumentos." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.rpc("guardar_tarea_plantilla", { p_tipo: tipo, p_items: items });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El nombre y quién la tocó van aparte: la función sólo se encarga de que las
  // tareas se reemplacen enteras o no se reemplacen.
  await sb.from("tarea_plantillas")
    .update({ nombre: String(b.nombre ?? "").trim() || null, updated_por: actor })
    .eq("tipo", tipo);

  return NextResponse.json({ ok: true });
}

/** DELETE: borra la plantilla — ese tipo vuelve a la de fábrica (o a nacer vacío). */
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const tipo = new URL(req.url).searchParams.get("tipo");
  if (!tipo) return NextResponse.json({ error: "Falta el tipo." }, { status: 400 });

  const sb = supabaseAdmin();
  // Los items caen solos por el `on delete cascade`.
  const { error } = await sb.from("tarea_plantillas").delete().eq("tipo", tipo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
