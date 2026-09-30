import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { TAG_DISENO } from "@/lib/diseno-catalogo";
import { validarDiseno, type FilaDiseno } from "@/lib/diseno-validar";
import raw from "@/data/diseno.json";

export const dynamic = "force-dynamic";

/**
 * Catálogo de diseño visual (precio al cliente Y costo del diseñador).
 *
 * SÓLO ADMIN: el costo es lo que se le paga al diseñador y de ahí sale el
 * margen. No hay DELETE ni alta: lo que no se vende se OCULTA, y los servicios
 * nuevos por ahora se agregan en data/diseno.json (llevan su estructura de
 * componentes y unidades).
 */

const pesos = (n: unknown) => `$${Number(n).toLocaleString("es-MX")}`;
const AVISO_SQL = "Falta correr supabase-diseno-catalogo.sql en Supabase.";
const tablaAusente = (msg: string) => /diseno_catalogo/i.test(msg) && /(does not exist|schema cache)/i.test(msg);

const estable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

function invalidar() {
  revalidateTag(TAG_DISENO, { expire: 0 });
  revalidatePath("/diseno");
}

/** Qué cambió, sin cifras del costo: la bitácora la ven quienes no son admin. */
function resumen(antes: FilaDiseno, nueva: FilaDiseno): string {
  const c: string[] = [];
  if (Number(antes.datos.precio) !== Number(nueva.datos.precio)) c.push(`precio ${pesos(antes.datos.precio)} → ${pesos(nueva.datos.precio)}`);
  if (Number(antes.datos.costo) !== Number(nueva.datos.costo)) c.push("costo del diseñador");
  if (antes.activo !== nueva.activo) c.push(nueva.activo ? "lo volvió a mostrar" : "lo ocultó");
  const resto = (d: Record<string, unknown>) => estable({ ...d, precio: 0, costo: 0 });
  if (resto(antes.datos) !== resto(nueva.datos)) c.push("textos/marcas");
  return c.join(", ") || "sin cambios";
}

export async function PUT(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  const sb = supabaseAdmin();

  const { data, error: eLeer } = await sb.from("diseno_catalogo").select("id, activo, datos").eq("id", id).maybeSingle();
  if (eLeer) return NextResponse.json({ error: tablaAusente(eLeer.message) ? AVISO_SQL : eLeer.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No existe." }, { status: 404 });
  const antes = data as FilaDiseno;

  const r = validarDiseno(b, antes, true);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  const cambio = resumen(antes, r.fila);
  if (cambio === "sin cambios") return NextResponse.json({ ok: true });

  const { error } = await sb
    .from("diseno_catalogo")
    .update({ activo: r.fila.activo, datos: r.fila.datos, updated_at: new Date().toISOString(), updated_por: email })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nombre = String((r.fila.datos.nombre as { es?: string }).es ?? id);
  const soloVisibilidad = antes.activo !== r.fila.activo && cambio.split(", ").length === 1;
  await registrarActividad(sb, {
    tipo: soloVisibilidad ? "servicio_visibilidad" : "servicio_editado",
    titulo: `${await nombreDeActor(sb, email)} cambió el diseño ${nombre} (${cambio})`,
    actor: email,
    entidad: "servicio",
    entidad_id: id,
    entidad_nombre: nombre,
  });
  invalidar();
  return NextResponse.json({ ok: true });
}

/** "Cargar el catálogo actual": por si la tabla existe pero quedó vacía. No pisa lo editado. */
export async function POST(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { accion?: unknown };
  if (b.accion !== "sembrar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });

  const filas = (raw.servicios as unknown as { id: string }[]).map(({ id, ...datos }, orden) => ({
    id, orden, activo: true, datos, updated_por: email,
  }));
  const { error } = await supabaseAdmin().from("diseno_catalogo").upsert(filas, { onConflict: "id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: tablaAusente(error.message) ? AVISO_SQL : error.message }, { status: 500 });
  invalidar();
  return NextResponse.json({ ok: true });
}
