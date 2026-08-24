import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Línea de tiempo de UN contacto: junta en un solo hilo cronológico todo lo que
 * pasó con esa persona — conversaciones del bot, cotizaciones, contratos,
 * ventas, producciones y notas del equipo.
 *
 * Se pide por contacto (no se precargan los 254) porque la ficha se abre de una
 * en una; mismo criterio que los pagos a músicos por venta.
 */

export interface EventoCrm {
  id: string;
  /** Familia del evento: define ícono y color en la UI. */
  clase: "mensaje" | "cotizacion" | "contrato" | "venta" | "proyecto" | "nota" | "recompra";
  titulo: string;
  detalle: string | null;
  fecha: string;
  canal?: string | null;
  monto?: number | null;
}

const ok = (s: { role: string } | null) => !!s && (s.role === "admin" || s.role === "crm");

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!ok(s)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const contactoId = new URL(req.url).searchParams.get("contacto_id");
  if (!contactoId) return NextResponse.json({ error: "Falta contacto_id" }, { status: 400 });

  const sb = supabaseAdmin();
  // Cada fuente es best-effort: si una tabla falta o falla, la línea de tiempo
  // se arma con las demás en vez de quedarse en blanco.
  const [inter, ventas, cots, contratos, proys] = await Promise.all([
    sb.from("interacciones").select("id, canal, tipo, resumen, ocurrio_at").eq("contacto_id", contactoId).order("ocurrio_at", { ascending: false }).limit(100),
    sb.from("ventas").select("id, folio, fecha, total_mxn, tipo, beat_nombre, canal").eq("contacto_id", contactoId).limit(100),
    sb.from("cotizaciones").select("id, folio, created_at, total, moneda, estado").eq("contacto_id", contactoId).limit(100),
    sb.from("contratos").select("id, folio, created_at, monto, concepto, estado").eq("contacto_id", contactoId).limit(100),
    sb.from("proyectos").select("id, folio, titulo, estado, created_at").eq("contacto_id", contactoId).limit(100),
  ]);

  const eventos: EventoCrm[] = [];

  for (const x of inter.data ?? []) {
    const esNota = x.tipo === "nota";
    const esRecompra = x.tipo === "recompra" || x.tipo === "recompra_omitida";
    eventos.push({
      id: `i-${x.id}`,
      clase: esNota ? "nota" : esRecompra ? "recompra" : "mensaje",
      titulo: esNota ? "Nota del equipo" : (x.resumen as string) || "Interacción",
      detalle: esNota ? ((x.resumen as string) ?? null) : null,
      fecha: (x.ocurrio_at as string) ?? new Date().toISOString(),
      canal: (x.canal as string | null) ?? null,
    });
  }
  for (const v of ventas.data ?? []) {
    eventos.push({
      id: `v-${v.id}`, clase: "venta",
      titulo: `Venta ${v.folio ?? ""}`.trim(),
      detalle: [v.tipo, v.beat_nombre].filter(Boolean).join(" · ") || null,
      fecha: (v.fecha as string) ?? "", canal: (v.canal as string | null) ?? null,
      monto: Number(v.total_mxn) || 0,
    });
  }
  for (const c of cots.data ?? []) {
    eventos.push({
      id: `c-${c.id}`, clase: "cotizacion",
      titulo: `Cotización ${c.folio ?? ""}`.trim(),
      detalle: (c.estado as string | null) ?? null,
      fecha: (c.created_at as string) ?? "", monto: Number(c.total) || 0,
    });
  }
  for (const c of contratos.data ?? []) {
    eventos.push({
      id: `ct-${c.id}`, clase: "contrato",
      titulo: `Contrato ${c.folio ?? ""}`.trim(),
      detalle: [c.concepto, c.estado].filter(Boolean).join(" · ") || null,
      fecha: (c.created_at as string) ?? "", monto: Number(c.monto) || 0,
    });
  }
  for (const p of proys.data ?? []) {
    eventos.push({
      id: `p-${p.id}`, clase: "proyecto",
      titulo: (p.titulo as string) || `Proyecto ${p.folio ?? ""}`,
      detalle: (p.estado as string | null) ?? null,
      fecha: (p.created_at as string) ?? "",
    });
  }

  eventos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return NextResponse.json({ eventos });
}

/** Nota manual del equipo ("le llamé", "quedó de avisar", etc.). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!ok(s)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const contactoId = String(b.contacto_id || "").trim();
  const texto = String(b.texto || "").trim();
  if (!contactoId || !texto) return NextResponse.json({ error: "Falta contacto o texto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("interacciones").insert({
    contacto_id: contactoId,
    tipo: "nota",
    resumen: texto,
    canal: null,
    ocurrio_at: new Date().toISOString(),
    metadata: { autor: s!.email },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
