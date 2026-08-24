import { NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Importador del sheet histórico "INGRESOS Y EGRESOS" → tablas del ERP.
// Lee cada pestaña por nombre vía el endpoint gviz (CSV) y siembra:
//   CRM Y TRACKING + INGRESOS.CLIENTE → contactos (dedup por nombre)
//   INVENTARIO DE BEATS              → inventario_beats
//   INGRESOS                         → ventas
//   EGRESOS                          → egresos
// Re-ejecutable: ventas/inventario por upsert(folio); contactos/egresos por
// chequeo de existentes. No borra nada.
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = "1lBeXXIIHBHq-sqYI-voFHCZeA4KkRim9tRLfb3zMWu8";
const gvizUrl = (tab: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

async function fetchTab(tab: string): Promise<string[][]> {
  const r = await fetch(gvizUrl(tab), { cache: "no-store" });
  if (!r.ok) throw new Error(`No se pudo leer la pestaña "${tab}" (${r.status})`);
  return parseCsv(await r.text());
}

// Parser CSV que respeta comillas y comillas escapadas ("").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignora */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const money = (s: string | undefined): number => {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[$,]/g, "").replace(/USD|MXN/gi, "").trim());
  return isNaN(n) ? 0 : n;
};

// "2/2/2026" / "16/1/2026" → "2026-02-02" (d/m/y; corrige si viene m/d)
const parseDate = (s: string | undefined): string | null => {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) {
    const iso = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? iso[0] : null;
  }
  let d = +m[1], mo = +m[2];
  const y = +m[3];
  if (mo > 12) [d, mo] = [mo, d];
  if (y < 2024 || y > 2030 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const normName = (s: string | undefined): string =>
  (s || "").replace(/\s+/g, " ").trim().toLowerCase();

const normChannel = (s: string | undefined): string | null => {
  const v = (s || "").toLowerCase();
  if (v.includes("whats")) return "whatsapp";
  if (v.includes("insta")) return "instagram";
  if (v.includes("tiktok") || v.includes("tik tok")) return "tiktok";
  if (v.includes("beatstar") || v.includes("beatstart")) return "beatstars";
  if (v.includes("facebook") || v.includes("messenger")) return "facebook";
  return null;
};

const etapaFromStatus = (s: string | undefined): string => {
  const v = (s || "").toLowerCase();
  if (v.includes("cerrado")) return "cliente";
  if (v.includes("perdido")) return "perdido";
  if (v.includes("negocia")) return "negociacion";
  return "lead";
};

export async function POST() {
  if (!(await getFullAdminEmail())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const sb = supabaseAdmin();
    const [ingresos, egresos, crm, inventario] = await Promise.all([
      fetchTab("INGRESOS"),
      fetchTab("EGRESOS"),
      fetchTab("CRM Y TRACKING"),
      fetchTab("INVENTARIO DE BEATS"),
    ]);

    const summary = { contactos: 0, ventas: 0, egresos: 0, inventario: 0, errores: [] as string[] };

    // ── Mapa de contactos existentes (dedup por nombre normalizado) ──────────
    const { data: existing } = await sb.from("contactos").select("id, nombre");
    const byName = new Map<string, string>(); // normName → id
    for (const c of existing ?? []) if (c.nombre) byName.set(normName(c.nombre), c.id);

    // Acumula la mejor info por persona (CRM aporta pipeline; INGRESOS, nombre)
    type NewC = {
      nombre: string; etapa: string; origen: string | null;
      servicio_interes: string | null; motivo_perdida: string | null;
    };
    const nuevos = new Map<string, NewC>();
    const consider = (nombre: string, info: Partial<NewC>) => {
      const key = normName(nombre);
      if (!key || byName.has(key)) return;
      const prev = nuevos.get(key);
      nuevos.set(key, {
        nombre: prev?.nombre || nombre.trim(),
        etapa: info.etapa || prev?.etapa || "lead",
        origen: info.origen ?? prev?.origen ?? null,
        servicio_interes: info.servicio_interes ?? prev?.servicio_interes ?? null,
        motivo_perdida: info.motivo_perdida ?? prev?.motivo_perdida ?? null,
      });
    };

    // CRM Y TRACKING (leads con pipeline)
    for (const r of crm.slice(1)) {
      if (!r[0] || !r[2]) continue;
      consider(r[2], {
        etapa: etapaFromStatus(r[6]),
        origen: normChannel(r[3]),
        servicio_interes: r[5]?.trim() || null,
        motivo_perdida: r[8]?.trim() || null,
      });
    }
    // INGRESOS (clientes que compraron)
    for (const r of ingresos.slice(1)) {
      const cli = r[8]?.trim();
      if (cli) consider(cli, { etapa: "cliente", origen: normChannel(r[3]) });
    }

    // Inserta contactos nuevos
    if (nuevos.size) {
      const toInsert = [...nuevos.values()];
      const { data, error } = await sb.from("contactos").insert(toInsert).select("id, nombre");
      if (error) summary.errores.push(`contactos: ${error.message}`);
      else {
        summary.contactos = data.length;
        for (const c of data) if (c.nombre) byName.set(normName(c.nombre), c.id);
      }
    }

    // ── INVENTARIO DE BEATS (upsert por folio) ───────────────────────────────
    const invRows = inventario.slice(1)
      .filter((r) => r[0] && r[1])
      .map((r) => ({
        folio: r[0].trim(),
        nombre: r[1].trim(),
        estado: (r[2] || "").toLowerCase().includes("vendido") ? "vendido" : "disponible",
      }));
    if (invRows.length) {
      const { error, count } = await sb
        .from("inventario_beats")
        .upsert(invRows, { onConflict: "folio", count: "exact" });
      if (error) summary.errores.push(`inventario: ${error.message}`);
      else summary.inventario = count ?? invRows.length;
    }

    // ── VENTAS (upsert por folio) ────────────────────────────────────────────
    const ventaRows = ingresos.slice(1)
      .filter((r) => r[0] && parseDate(r[1]) && money(r[7]) > 0)
      .map((r) => ({
        folio: r[0].trim(),
        fecha: parseDate(r[1]),
        contacto_id: r[8]?.trim() ? byName.get(normName(r[8])) ?? null : null,
        tipo: r[2]?.trim() || null,
        beat_nombre: r[10]?.trim() || null,
        canal: normChannel(r[3]),
        moneda: (r[4]?.trim() || "MXN").toUpperCase(),
        monto_cobrado: money(r[6]) || null,
        tipo_cambio: money(r[9]) || null,
        total_mxn: money(r[7]),
        medio_pago: r[5]?.trim() || null,
        costo_extra: money(r[17]),
        extras: r[16]?.trim() || null,
        quien_cerro: r[18]?.trim() || null,
        split_legacy: { eliud: money(r[13]), luis: money(r[14]), tozi: money(r[15]) },
      }));
    if (ventaRows.length) {
      const { error, count } = await sb
        .from("ventas")
        .upsert(ventaRows, { onConflict: "folio", count: "exact" });
      if (error) summary.errores.push(`ventas: ${error.message}`);
      else summary.ventas = count ?? ventaRows.length;
    }

    // ── EGRESOS (inserta solo folios nuevos) ─────────────────────────────────
    const { data: egExist } = await sb.from("egresos").select("folio");
    const egFolios = new Set((egExist ?? []).map((e) => e.folio).filter(Boolean));
    const egRows = egresos.slice(1)
      .filter((r) => r[0] && parseDate(r[1]) && money(r[7]) > 0 && !egFolios.has(r[0].trim()))
      .map((r) => ({
        folio: r[0].trim(),
        fecha: parseDate(r[1]),
        categoria: r[2]?.trim() || null,
        proveedor: r[3]?.trim() || null,
        descripcion: r[4]?.trim() || null,
        monto_sin_iva: money(r[5]) || null,
        iva: money(r[6]),
        total_mxn: money(r[7]),
        es_capex: (r[2] || "").toLowerCase().includes("equipo"),
      }));
    if (egRows.length) {
      const { error, count } = await sb.from("egresos").insert(egRows, { count: "exact" });
      if (error) summary.errores.push(`egresos: ${error.message}`);
      else summary.egresos = count ?? egRows.length;
    }

    // ── Recalcula LTV y etapa de contactos con ventas ────────────────────────
    const agg = new Map<string, { sum: number; n: number }>();
    for (const v of ventaRows) {
      if (!v.contacto_id) continue;
      const a = agg.get(v.contacto_id) ?? { sum: 0, n: 0 };
      a.sum += v.total_mxn; a.n += 1;
      agg.set(v.contacto_id, a);
    }
    for (const [id, a] of agg) {
      await sb.from("contactos")
        .update({ ltv: a.sum, etapa: a.n > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
