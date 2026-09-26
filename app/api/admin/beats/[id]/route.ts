import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { moduloPermitido, getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { beatParaPanel, preciosDeBeat } from "@/lib/catalog";
import { getBeatAdmin } from "@/lib/beat-admin";
import { validarFicha, describirCambioPrecios, type CambiosFicha, type FichaRow } from "@/lib/beat-ficha";
import { registrarActividad, type ActividadTipo } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const ID_VALIDO = /^[A-Za-z0-9_-]{2,40}$/;

/** Ficha completa del beat para el panel. Las ventas sólo para admin. */
export async function GET(_req: NextRequest, { params }: Props) {
  if (!(await moduloPermitido("/admin/beats"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ error: "Beat inválido." }, { status: 400 });
  const detalle = await getBeatAdmin(id, { verVentas: Boolean(await getFullAdminEmail()) });
  if (!detalle) return NextResponse.json({ error: "Ese beat no existe." }, { status: 404 });
  return NextResponse.json(detalle);
}

const falta = (msg: string) => /beat_ficha/i.test(msg) && /(does not exist|schema cache)/i.test(msg);

/**
 * Guarda cambios de la ficha. Sólo toca los campos que vienen (lista blanca en
 * `validarFicha`); mandar un campo en null lo regresa a "lo de siempre".
 */
export async function PATCH(req: NextRequest, { params }: Props) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!rateLimit(`beat-ficha:${email}`, 60, 60_000)) {
    return NextResponse.json({ error: "Demasiados cambios seguidos. Espera un momento." }, { status: 429 });
  }
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ error: "Beat inválido." }, { status: 400 });

  const v = validarFicha(await req.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const actual = await beatParaPanel(id);
  if (!actual) return NextResponse.json({ error: "Ese beat no existe." }, { status: 404 });
  if (!actual.tablaFicha) {
    return NextResponse.json({ error: "Falta correr supabase-beat-ficha.sql en Supabase." }, { status: 503 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("beat_ficha").upsert(
    { beat_id: id, ...v.valor, actualizado_por: email, updated_at: new Date().toISOString() },
    { onConflict: "beat_id" },
  );
  if (error) {
    return NextResponse.json(
      { error: falta(error.message) ? "Falta correr supabase-beat-ficha.sql en Supabase." : error.message },
      { status: 500 },
    );
  }

  // Volver a mostrar un original que se ocultó a la manera VIEJA (una fila
  // `active:false` en `beats`): esa fila también lo tapa, hay que quitarla.
  if (v.valor.oculto === false && actual.fila && actual.fila.active === false) {
    if (actual.source === "original") await sb.from("beats").delete().eq("id", id);
    else await sb.from("beats").update({ active: true }).eq("id", id);
  }

  // Expira YA (no "max"): quien edita abre la tienda enseguida para ver su cambio.
  revalidateTag("catalog", { expire: 0 });

  await registrar(sb, email, id, actual.beat.title, actual.ficha, v.valor);
  return NextResponse.json({ ok: true });
}

/** Deja en la bitácora qué cambió, con palabras. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function registrar(sb: any, actor: string, id: string, titulo: string, antes: FichaRow | null, c: CambiosFicha) {
  const base = { actor, entidad: "beat" as const, entidad_id: id, entidad_nombre: titulo };
  const evento = (tipo: ActividadTipo, texto: string, meta?: Record<string, unknown>) =>
    registrarActividad(sb, { ...base, tipo, titulo: texto, meta: meta ?? null });

  if ("precios" in c || "exclusiva_modo" in c) {
    const previa = preciosDeBeat(id, antes);
    const nueva = preciosDeBeat(id, {
      ...(antes ?? ({} as FichaRow)),
      ...("precios" in c ? { precios: c.precios ?? null } : {}),
      ...("exclusiva_modo" in c ? { exclusiva_modo: c.exclusiva_modo ?? null } : {}),
    } as FichaRow);
    const cambios = describirCambioPrecios(previa, nueva);
    if (cambios.length) await evento("beat_precio", `Precios de ${titulo}: ${cambios.join(", ")}`, { antes: previa, despues: nueva });
  }
  if ("oculto" in c && Boolean(antes?.oculto) !== c.oculto) {
    await evento("beat_visibilidad", `${titulo} ${c.oculto ? "se ocultó de" : "volvió a"} la tienda`);
  }
  if ("destacado" in c && Boolean(antes?.destacado) !== c.destacado) {
    await evento("beat_visibilidad", `${titulo} ${c.destacado ? "quedó destacado" : "ya no está destacado"} en la tienda`);
  }
  const ficha = (Object.keys(c) as (keyof CambiosFicha)[]).filter(
    (k) => !["precios", "exclusiva_modo", "oculto", "destacado"].includes(k),
  );
  if (ficha.length) await evento("beat_editado", `Ficha de ${titulo} editada (${ficha.join(", ")})`);
}
