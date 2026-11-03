import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido, type ProyectoDePedido } from "@/lib/cuenta-cliente";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { metadatosArchivo } from "@/lib/drive-oauth";
import { pushAEmails, destinoProyecto, conProyecto } from "@/lib/push";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { registrarActividad } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";
import { aceptaVoces, pideTema, esWav, estadoVoz, MAX_VOCES_POR_PROYECTO } from "@/lib/voces-cliente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const MAX_NOMBRE = 200;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

/** Las canciones de un EP/álbum, en orden: a cuál de ellas va la voz. */
async function temasDe(sb: SB, proyectoId: string): Promise<{ id: string; titulo: string }[]> {
  const { data } = await sb
    .from("proyecto_tareas")
    .select("id, titulo, orden")
    .eq("proyecto_id", proyectoId)
    .eq("es_cancion", true)
    .order("orden", { ascending: true });
  return ((data ?? []) as { id: string; titulo: string }[]).map((t) => ({ id: t.id, titulo: t.titulo }));
}

async function proyectoDelCliente(id: string): Promise<{ email: string; proy: ProyectoDePedido } | NextResponse> {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  return { email, proy };
}

/**
 * Lo que necesita la caja "Tus voces": si este pedido las recibe, las canciones
 * (EP/álbum) y lo que ya subió con su estado. `disponible: false` = la tabla
 * todavía no existe (SQL sin correr) y la caja no se muestra.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const r = await proyectoDelCliente((await params).id);
  if (r instanceof NextResponse) return r;
  const { proy } = r;
  if (!aceptaVoces(proy.tipo)) return NextResponse.json({ acepta: false });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("voces_cliente")
    .select("id, nombre, bytes, tema_id, subido_at, importado_at")
    .eq("proyecto_id", proy.proyectoId)
    .order("subido_at", { ascending: true });
  if (error) return NextResponse.json({ acepta: true, disponible: false });

  const conTema = pideTema(proy.tipo);
  return NextResponse.json({
    acepta: true,
    disponible: true,
    pideTema: conTema,
    temas: conTema ? await temasDe(sb, proy.proyectoId) : [],
    voces: (data ?? []).map((v: { id: string; nombre: string; bytes: number | null; tema_id: string | null; importado_at: string | null }) => ({
      id: v.id,
      nombre: v.nombre,
      bytes: v.bytes != null ? Number(v.bytes) : null,
      temaId: v.tema_id,
      estado: estadoVoz(v),
    })),
  });
}

/**
 * Registra una voz que el navegador del cliente ya subió DIRECTO a Drive (con
 * la sesión que le abrió `../subida`). Es lo que hace que el estudio la baje y la meta a
 * VOX GRP: sin esta fila el archivo sólo vive en Drive, como antes.
 *
 * No se confía en lo que dice el navegador: el archivo tiene que existir y vivir
 * en la carpeta de Drive de ESTE proyecto. Si no, cualquiera podría hacer que el
 * estudio bajara a su sesión un archivo ajeno.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const r = await proyectoDelCliente((await params).id);
  if (r instanceof NextResponse) return r;
  const { email, proy } = r;
  if (!aceptaVoces(proy.tipo)) return NextResponse.json({ error: "Este pedido no recibe voces." }, { status: 400 });

  if (!rateLimit(`voces:${email}`, 40, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre || "").trim().slice(0, MAX_NOMBRE);
  const driveId = String(b.driveId || "").trim();
  const temaId = b.temaId ? String(b.temaId) : null;

  if (!nombre || !DRIVE_ID.test(driveId)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  // La del navegador es una comodidad; ésta es la que vale.
  if (!esWav(nombre)) return NextResponse.json({ error: "Tu voz tiene que ser un archivo WAV." }, { status: 400 });

  const sb = supabaseAdmin();

  let tema: { id: string; titulo: string } | null = null;
  if (pideTema(proy.tipo)) {
    tema = (await temasDe(sb, proy.proyectoId)).find((t) => t.id === temaId) ?? null;
    if (!tema) return NextResponse.json({ error: "Elige de qué canción es la voz." }, { status: 400 });
  }

  const folderId = await carpetaDelProyecto(sb, proy.proyectoId);
  const meta = folderId ? await metadatosArchivo(driveId) : null;
  if (!folderId || !meta || !meta.parents.includes(folderId)) {
    return NextResponse.json({ error: "No encontramos tu archivo en la carpeta de tu proyecto. Intenta subirlo otra vez." }, { status: 400 });
  }

  const { count } = await sb.from("voces_cliente").select("id", { count: "exact", head: true }).eq("proyecto_id", proy.proyectoId);
  if ((count ?? 0) >= MAX_VOCES_POR_PROYECTO) {
    return NextResponse.json({ error: "Ya subiste muchas voces a este pedido. Escríbenos por WhatsApp si te faltan." }, { status: 400 });
  }

  const nombreFinal = esWav(meta.name) ? meta.name.slice(0, MAX_NOMBRE) : nombre;
  const { error } = await sb.from("voces_cliente").insert({
    proyecto_id: proy.proyectoId,
    tema_id: tema?.id ?? null,
    nombre: nombreFinal,
    drive_id: driveId,
    bytes: meta.size,
    subido_por: email,
  });
  // 23505: esa misma subida ya estaba anotada (doble clic, reintento): no es error.
  if (error && error.code !== "23505") {
    console.error("[voces] no se pudo registrar:", error.message);
    return NextResponse.json({ error: "Tu voz quedó en Drive, pero no pudimos mandarla al estudio. Avísanos por WhatsApp." }, { status: 500 });
  }
  if (error) return NextResponse.json({ ok: true });

  await avisarAlEstudio(sb, proy, { nombre: nombreFinal, tema: tema?.titulo ?? null, email });
  return NextResponse.json({ ok: true });
}

/** Un aviso al equipo y una línea en la bitácora. Nunca tumba la subida. */
async function avisarAlEstudio(sb: SB, proy: ProyectoDePedido, d: { nombre: string; tema: string | null; email: string }) {
  try {
    const { data: p } = await sb.from("proyectos").select("responsables, responsable_id").eq("id", proy.proyectoId).maybeSingle();
    const ids = [...new Set([...((p?.responsables as string[] | null) ?? []), p?.responsable_id as string | null].filter((x): x is string => Boolean(x)))];
    const { data: eq } = ids.length ? await sb.from("equipo").select("email").in("id", ids) : { data: [] };
    // Una sola lista: con dos envíos, un admin que además es responsable lo recibiría doble.
    const correos = [...((eq ?? []) as { email: string | null }[]).map((r) => r.email), ...adminEmails(), ...crmEmails()];
    const que = d.tema ? `${d.nombre} (${d.tema})` : d.nombre;
    await pushAEmails(sb, correos, {
      titulo: "🎤 Voz nueva del cliente",
      cuerpo: conProyecto(proy.titulo, `${que} — entra sola a VOX GRP en REAPER`),
      url: destinoProyecto(proy.proyectoId),
    });
    await registrarActividad(sb, {
      tipo: "voz_cliente",
      titulo: `El cliente subió su voz “${que}”`,
      actor: d.email,
      proyecto_id: proy.proyectoId,
      meta: { nombre: d.nombre, tema: d.tema },
    });
  } catch (e) {
    console.error("[voces] aviso:", e);
  }
}
