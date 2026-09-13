import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizarMedio } from "@/lib/medios-pago";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

const COLUMNAS = ["tipo", "fecha", "folio", "concepto", "cliente_o_persona", "canal", "medio_pago", "monto_mxn"] as const;

const celda = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const nombre = (x: unknown) => ((x as Fila | null)?.nombre as string | undefined) ?? "";

// Un CSV con todo el año para el contador: cobros, otros ingresos, egresos,
// nómina y repartos. Los cobros van en base efectivo (lo que entró y cuándo),
// igual que Finanzas: un renglón por pago, o la venta completa si no tiene pagos.
export async function GET(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const anio = Number(new URL(req.url).searchParams.get("anio")) || new Date().getFullYear();
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`;
  const sb = supabaseAdmin();

  const [ventasRes, pagosRes, ingresosRes, egresosRes, nominaRes, repartosRes] = await Promise.all([
    sb.from("ventas").select("id, folio, fecha, total_mxn, canal, tipo, beat_nombre, medio_pago, contactos(nombre)").limit(5000),
    sb.from("pagos").select("venta_id, fecha, monto_mxn, tipo, medio_pago").limit(5000),
    sb.from("ingresos").select("folio, fecha, fuente, concepto, monto_mxn").gte("fecha", desde).lte("fecha", hasta).limit(5000),
    sb.from("egresos").select("folio, fecha, categoria, proveedor, descripcion, total_mxn, es_capex").gte("fecha", desde).lte("fecha", hasta).limit(5000),
    sb.from("nomina").select("periodo_inicio, monto, tipo, equipo(nombre)").gte("periodo_inicio", desde).lte("periodo_inicio", hasta).limit(5000),
    sb.from("repartos").select("periodo, notas, reparto_socio(monto, fecha_pago, equipo(nombre))").limit(500),
  ]);

  const filas: Fila[] = [];
  const enAnio = (f: string | null | undefined) => !!f && f >= desde && f <= hasta;

  const ventas = new Map<string, Fila>((ventasRes.data ?? []).map((v) => [v.id as string, v]));
  const conPagos = new Set((pagosRes.data ?? []).map((p) => p.venta_id as string));
  for (const p of pagosRes.data ?? []) {
    if (!enAnio(p.fecha)) continue;
    const v = ventas.get(p.venta_id as string);
    filas.push({
      tipo: "cobro", fecha: p.fecha, folio: v?.folio ?? "",
      concepto: [p.tipo, v?.beat_nombre || v?.tipo].filter(Boolean).join(" · "),
      cliente_o_persona: nombre(v?.contactos), canal: v?.canal ?? "",
      medio_pago: normalizarMedio(p.medio_pago ?? v?.medio_pago) ?? "", monto_mxn: Number(p.monto_mxn) || 0,
    });
  }
  for (const v of ventas.values()) {
    if (conPagos.has(v.id as string) || !enAnio(v.fecha)) continue;
    filas.push({
      tipo: "cobro", fecha: v.fecha, folio: v.folio ?? "", concepto: v.beat_nombre || v.tipo || "",
      cliente_o_persona: nombre(v.contactos), canal: v.canal ?? "",
      medio_pago: normalizarMedio(v.medio_pago) ?? "", monto_mxn: Number(v.total_mxn) || 0,
    });
  }
  for (const i of ingresosRes.data ?? []) {
    filas.push({ tipo: "otro_ingreso", fecha: i.fecha, folio: i.folio ?? "", concepto: [i.fuente, i.concepto].filter(Boolean).join(" · "), monto_mxn: Number(i.monto_mxn) || 0 });
  }
  for (const e of egresosRes.data ?? []) {
    filas.push({
      tipo: e.es_capex ? "inversion" : "egreso", fecha: e.fecha, folio: e.folio ?? "",
      concepto: [e.categoria, e.descripcion].filter(Boolean).join(" · "), cliente_o_persona: e.proveedor ?? "",
      monto_mxn: Number(e.total_mxn) || 0,
    });
  }
  for (const n of nominaRes.data ?? []) {
    filas.push({ tipo: "nomina", fecha: n.periodo_inicio, concepto: n.tipo ?? "sueldo", cliente_o_persona: nombre(n.equipo), monto_mxn: Number(n.monto) || 0 });
  }
  for (const r of repartosRes.data ?? []) {
    for (const s of (r.reparto_socio as Fila[] | null) ?? []) {
      if (!enAnio(s.fecha_pago)) continue;
      filas.push({ tipo: "reparto", fecha: s.fecha_pago, folio: r.periodo, concepto: r.notas ?? "", cliente_o_persona: nombre(s.equipo), monto_mxn: Number(s.monto) || 0 });
    }
  }

  filas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.tipo).localeCompare(String(b.tipo)));
  const csv = "﻿" + [COLUMNAS.join(","), ...filas.map((f) => COLUMNAS.map((c) => celda(f[c])).join(","))].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arido-finanzas-${anio}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
