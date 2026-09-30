import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { TAG_SERVICIOS } from "@/lib/servicios-catalogo";
import { CATALOGO_SEMILLA } from "@/lib/servicios";
import { TIPOS_SERVICIO, validarServicio, type FilaServicio, type TipoServicio } from "@/lib/servicios-validar";

export const dynamic = "force-dynamic";

/**
 * Catálogo del cotizador (paquetes, instrumentos, servicios de estudio).
 *
 * Lo edita quien tenga el módulo "Servicios" (admin siempre; el resto, si un
 * admin se lo prendió). NO hay DELETE a propósito: lo que ya no se vende se
 * OCULTA. Las cotizaciones viejas, las plantillas de REAPER y el reparto de
 * tareas siguen colgando de esos ids.
 */

const MODULO = "/admin/servicios";
const NOMBRE_TIPO: Record<TipoServicio, string> = { base: "el paquete", extra: "el instrumento", studio: "el servicio" };
const pesos = (n: unknown) => `$${Number(n).toLocaleString("es-MX")}`;

interface FilaDb { tipo: TipoServicio; id: string; orden: number; activo: boolean; datos: Record<string, unknown> }

const tablaAusente = (msg: string) => /servicios_catalogo/i.test(msg) && /(does not exist|schema cache)/i.test(msg);
const AVISO_SQL = "Falta correr supabase-servicios-catalogo.sql en Supabase.";

/** JSON con las llaves ordenadas: jsonb no conserva el orden y daría cambios falsos. */
const estable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

/** Qué cambió, en una frase para la bitácora. */
function resumenCambio(antes: FilaDb | null, nueva: FilaServicio): string {
  if (!antes) return "lo creó";
  const cambios: string[] = [];
  if (Number(antes.datos.price) !== Number(nueva.datos.price)) {
    cambios.push(`precio ${pesos(antes.datos.price)} → ${pesos(nueva.datos.price)}`);
  }
  if (antes.activo !== nueva.activo) cambios.push(nueva.activo ? "lo volvió a mostrar" : "lo ocultó");
  const otros = estable({ ...antes.datos, price: 0 }) !== estable({ ...nueva.datos, price: 0 });
  if (otros) cambios.push("textos/contenido");
  return cambios.join(", ") || "sin cambios";
}

function invalidar() {
  revalidateTag(TAG_SERVICIOS, { expire: 0 }); // el cotizador y el cobro ven el cambio al instante
  revalidatePath("/cotizador");
}

/** Ids de extras que existen hoy (un paquete sólo puede incluir extras reales). */
async function idsExtras(sb: ReturnType<typeof supabaseAdmin>): Promise<Set<string>> {
  const { data } = await sb.from("servicios_catalogo").select("id").eq("tipo", "extra");
  return new Set((data ?? []).map((r) => r.id as string));
}

/** ¿Ocultar/quitar esto dejaría el cotizador sin ningún paquete a la venta? */
async function quedariaSinPaquetes(sb: ReturnType<typeof supabaseAdmin>, id: string): Promise<boolean> {
  const { count } = await sb
    .from("servicios_catalogo")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "base").eq("activo", true).neq("id", id);
  return (count ?? 0) === 0;
}

async function bitacora(sb: ReturnType<typeof supabaseAdmin>, email: string, tipo: TipoServicio, fila: FilaServicio, antes: FilaDb | null) {
  const nombre = String((fila.datos.name as { es?: string } | undefined)?.es ?? (fila.datos.label as { es?: string } | undefined)?.es ?? fila.id);
  const quien = await nombreDeActor(sb, email);
  const cambio = resumenCambio(antes, fila);
  const soloVisibilidad = !!antes && antes.activo !== fila.activo && cambio.split(", ").length === 1;
  await registrarActividad(sb, {
    tipo: !antes ? "servicio_creado" : soloVisibilidad ? "servicio_visibilidad" : "servicio_editado",
    titulo: `${quien} ${antes ? "cambió" : "agregó"} ${NOMBRE_TIPO[tipo]} ${nombre}${antes ? ` (${cambio})` : ""}`,
    actor: email,
    entidad: "servicio",
    entidad_id: fila.id,
    entidad_nombre: nombre,
  });
}

/** Crea un elemento nuevo. El id sale del nombre y ya no cambia. */
export async function POST(req: NextRequest) {
  const email = await moduloPermitido(MODULO);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = supabaseAdmin();

  // "Cargar el catálogo actual": por si la tabla existe pero quedó vacía.
  if (b.accion === "sembrar") {
    const filas = [
      ...CATALOGO_SEMILLA.bases.map(({ id, activo, ...datos }, i) => ({ tipo: "base", id, orden: i, activo, datos })),
      ...CATALOGO_SEMILLA.extras.map(({ id, activo, ...datos }, i) => ({ tipo: "extra", id, orden: i, activo, datos })),
      ...CATALOGO_SEMILLA.studio.map(({ id, activo, ...datos }, i) => ({ tipo: "studio", id, orden: i, activo, datos })),
    ].map((f) => ({ ...f, updated_por: email }));
    const { error } = await sb.from("servicios_catalogo").upsert(filas, { onConflict: "tipo,id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: tablaAusente(error.message) ? AVISO_SQL : error.message }, { status: 500 });
    invalidar();
    return NextResponse.json({ ok: true });
  }

  const extras = await idsExtras(sb);
  const r = validarServicio(b.tipo, b, extras);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  const { data: existe, error: eLeer } = await sb
    .from("servicios_catalogo").select("id").eq("tipo", r.fila.tipo).eq("id", r.fila.id).maybeSingle();
  if (eLeer) return NextResponse.json({ error: tablaAusente(eLeer.message) ? AVISO_SQL : eLeer.message }, { status: 500 });
  if (existe) return NextResponse.json({ error: "Ya existe uno con ese nombre. Edítalo o usa otro nombre." }, { status: 409 });

  const { data: ult } = await sb
    .from("servicios_catalogo").select("orden").eq("tipo", r.fila.tipo).order("orden", { ascending: false }).limit(1);
  const orden = ((ult?.[0]?.orden as number | undefined) ?? -1) + 1;

  const { error } = await sb.from("servicios_catalogo").insert({ ...r.fila, orden, updated_por: email });
  if (error) {
    // Doble clic con el mismo nombre: el índice único gana la carrera.
    if (error.code === "23505") return NextResponse.json({ error: "Ya existe uno con ese nombre. Edítalo o usa otro nombre." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await bitacora(sb, email, r.fila.tipo, r.fila, null);
  invalidar();
  return NextResponse.json({ ok: true, id: r.fila.id });
}

/** Edita uno existente (precio, textos, visibilidad, contenido del paquete). El id no cambia. */
export async function PUT(req: NextRequest) {
  const email = await moduloPermitido(MODULO);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  const sb = supabaseAdmin();

  const { data: antes, error: eLeer } = await sb
    .from("servicios_catalogo").select("tipo, id, orden, activo, datos").eq("tipo", String(b.tipo)).eq("id", id).maybeSingle();
  if (eLeer) return NextResponse.json({ error: tablaAusente(eLeer.message) ? AVISO_SQL : eLeer.message }, { status: 500 });
  if (!antes) return NextResponse.json({ error: "No existe." }, { status: 404 });

  // Si el cuerpo no trae `activo`, se conserva el de antes (no se reabre lo oculto por omisión).
  const r = validarServicio(b.tipo, { ...b, activo: b.activo ?? antes.activo }, await idsExtras(sb), id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  if (r.fila.tipo === "base" && !r.fila.activo && antes.activo && (await quedariaSinPaquetes(sb, id))) {
    return NextResponse.json({ error: "No se puede ocultar el último paquete a la venta: el cotizador quedaría vacío." }, { status: 400 });
  }

  const { error } = await sb
    .from("servicios_catalogo")
    .update({ activo: r.fila.activo, datos: r.fila.datos, updated_at: new Date().toISOString(), updated_por: email })
    .eq("tipo", r.fila.tipo).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const previo = antes as FilaDb;
  if (resumenCambio(previo, r.fila) !== "sin cambios") await bitacora(sb, email, r.fila.tipo, r.fila, previo);
  invalidar();
  return NextResponse.json({ ok: true });
}

/** Reordena: recibe los ids de un tipo en el orden nuevo. */
export async function PATCH(req: NextRequest) {
  const email = await moduloPermitido(MODULO);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { tipo?: unknown; ids?: unknown };
  if (!TIPOS_SERVICIO.includes(b.tipo as TipoServicio) || !Array.isArray(b.ids)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const sb = supabaseAdmin();

  // Ids que de verdad existen, en el orden pedido; los que no vengan se quedan
  // detrás en su orden actual (si no, chocarían con los reasignados).
  const { data: actuales, error: eLeer } = await sb
    .from("servicios_catalogo").select("id").eq("tipo", b.tipo as string).order("orden");
  if (eLeer) return NextResponse.json({ error: eLeer.message }, { status: 500 });
  const existentes = (actuales ?? []).map((x) => x.id as string);
  const pedidos = [...new Set((b.ids as unknown[]).map(String))].filter((id) => existentes.includes(id));
  const ids = [...pedidos, ...existentes.filter((id) => !pedidos.includes(id))];

  const resultados = await Promise.all(
    ids.map((id, orden) => sb.from("servicios_catalogo").update({ orden }).eq("tipo", b.tipo as string).eq("id", id)),
  );
  const fallo = resultados.find((x) => x.error);
  if (fallo?.error) return NextResponse.json({ error: fallo.error.message }, { status: 500 });

  invalidar();
  return NextResponse.json({ ok: true });
}
