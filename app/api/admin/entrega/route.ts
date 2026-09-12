import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderizables, encolarRender } from "@/lib/render-jobs";
import { leerOpciones } from "@/lib/render-opciones";
import { saldoDelProyecto, cuentaCobro, porQueNoEntregar, type MarcaEntrega } from "@/lib/entrega";
import { entregaListaEmail, entregaRetenidaEmail } from "@/lib/emails";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El cuadro de entrega: Entregables + Stems de un golpe.
 *
 * Mismo permiso que lanzar un render suelto: esto enciende REAPER en la
 * máquina del estudio.
 */

/** GET: lo que necesita el cuadro — la carpeta de REAPER, el saldo y cómo se verían los correos. */
export async function GET(req: NextRequest) {
  if (!(await moduloPermitido("/admin/dev-logs"))) {
    return NextResponse.json({ error: "Sólo quien puede lanzar renders prepara la entrega." }, { status: 401 });
  }
  const proyectoId = req.nextUrl.searchParams.get("proyectoId") ?? "";
  const tareaId = req.nextUrl.searchParams.get("tareaId") || null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const [lista, { data: p }] = await Promise.all([
    renderizables(),
    sb.from("proyectos").select("id, titulo, venta_id, contactos(nombre)").eq("id", proyectoId).maybeSingle(),
  ]);
  if (!p) return NextResponse.json({ error: "Ese proyecto ya no existe." }, { status: 404 });
  const espera = await porQueNoEntregar(sb, proyectoId, tareaId);
  if (espera) return NextResponse.json({ error: espera }, { status: 409 });

  const r = lista.find((x) => x.proyectoId === proyectoId && (x.tareaId ?? null) === tareaId) ?? null;
  const s = await saldoDelProyecto(sb, p);
  const tema = r?.titulo ?? (p.titulo as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nombre = (((p.contactos as any)?.nombre as string | null) ?? null)?.split(" ")[0] ?? null;

  // Vista previa: exactamente lo que le va a llegar, con el botón apuntando a "#".
  // Sin pagos registrados cuenta como que falta todo (ver `ventaLiquidada`).
  const cc = s ? cuentaCobro(s) : null;
  const retenida = (urlPago: string | null) => s && cc
    ? entregaRetenidaEmail({
        nombre, concepto: tema, folio: s.folio, ...cc,
        urlPago, urlPanel: "#", conStems: true,
      }).html
    : null;

  return NextResponse.json({
    p: r,
    titulo: tema,
    saldo: cc,
    previews: {
      lista: entregaListaEmail({ customerName: nombre, concepto: tema, conStems: true, url: "#" }).html,
      retenidaConPago: retenida("#"),
      retenidaSinPago: retenida(null),
    },
  });
}

/** POST: encola el lote. Se encola todo al final, nunca un render a medias. */
export async function POST(req: NextRequest) {
  const email = await moduloPermitido("/admin/dev-logs");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  const espera = await porQueNoEntregar(supabaseAdmin(), proyectoId, tareaId);
  if (espera) return NextResponse.json({ error: espera }, { status: 409 });

  const ent = leerOpciones(b.entregables);
  if (!ent.ok) return NextResponse.json({ error: ent.error }, { status: 400 });
  if (!ent.op?.rpp) return NextResponse.json({ error: "Elige el proyecto base de los entregables." }, { status: 400 });
  const stems = b.stems ? leerOpciones(b.stems) : null;
  if (stems && !stems.ok) return NextResponse.json({ error: stems.error }, { status: 400 });

  const marca: MarcaEntrega = { lote: randomUUID(), avisar: b.avisar === true, conPago: b.conPago === true };

  // `avisar: false` a propósito: el correo de la entrega lo manda `cerrarEntrega`
  // UNA vez por lote, y sólo si el cliente ya liquidó. El aviso suelto de cada
  // render le mandaría dos correos y le enseñaría archivos que no puede abrir.
  const { pistas: _sinPistas, ...opEnt } = ent.op;
  const r1 = await encolarRender(proyectoId, tareaId, "entregables", email, { ...opEnt, avisar: false, entrega: marca });
  if (!r1.ok) return NextResponse.json({ error: r1.error }, { status: 409 });

  let stemsError: string | null = null;
  if (stems?.ok) {
    const r2 = await encolarRender(proyectoId, tareaId, "stems", email, { ...(stems.op ?? {}), avisar: false, entrega: marca });
    // Los entregables ya quedaron en cola; el lote se cierra sólo con ellos.
    if (!r2.ok) stemsError = r2.error;
  }

  await registrarActividad(supabaseAdmin(), {
    tipo: "entrega_preparada",
    titulo: `Se preparó la entrega: entregables${stems?.ok && !stemsError ? " + stems" : ""}${marca.avisar ? " · con aviso al cliente" : ""}`,
    actor: email, proyecto_id: proyectoId, tarea_id: tareaId,
    meta: { lote: marca.lote, avisar: marca.avisar, conPago: marca.conPago },
  });

  return NextResponse.json({ ok: true, lote: marca.lote, stemsError });
}
