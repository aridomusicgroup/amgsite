import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarPagoDeContado } from "@/lib/fidelidad-server";

export const dynamic = "force-dynamic";

/** Compara dos strings en tiempo constante (evita side-channel de timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const r2 = (n: number) => Math.round(n * 100) / 100; // a 2 decimales (centavos)

// Tipo de cambio USD→MXN. Se actualiza SOLO con el mercado:
//   1. Mercado en vivo (open.er-api.com) × BEATSTARS_FX_SPREAD (margen de PayPal,
//      ~4% abajo del mercado; default 0.96) → se ajusta cada que fluctúa el peso.
//   2. Si la fuente falla: respaldo manual BEATSTARS_FX, o 16.8.
async function getFX(): Promise<number> {
  const spread = Number(process.env.BEATSTARS_FX_SPREAD) || 0.96;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const d = await res.json();
    const mkt = Number(d?.rates?.MXN);
    if (mkt > 0) return r2(mkt * spread);
  } catch { /* API caída → usa el respaldo */ }
  return Number(process.env.BEATSTARS_FX) || 16.8;
}

// Costo REAL para el vendedor por venta de BeatStars: la comisión de PayPal
// (~6.5% del precio de lista). El "Comisión del partner" de BeatStars lo paga el
// cliente encima, así que no es costo del vendedor. Se registra como egreso para
// que la utilidad/reparto queden netos. Ej. beat $50 → neto ~$46.75.
const COMISION_PCT = 0.065;

// ─────────────────────────────────────────────────────────────────────────────
// Recibe el correo de venta de BeatStars (reenviado por un Google Apps Script) y
// lo convierte en una VENTA + CONTACTO en el ERP. Protegido por un secreto
// compartido (BEATSTARS_EMAIL_SECRET). Idempotente por el messageId del correo.
// ─────────────────────────────────────────────────────────────────────────────
function parseEmail(body: string) {
  const text = (body || "").replace(/\r/g, "");

  // Email del comprador: el primero que NO sea de beatstars
  const emails = (text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || []).filter((e) => !/beatstars/i.test(e));
  const email = emails[0] ? emails[0].toLowerCase() : null;

  // Total: "Total $ 50.00" o el primer monto con centavos
  const tM = text.match(/total[^\d$]*\$?\s*([\d,]+\.\d{2})/i) || text.match(/\$\s*([\d,]+\.\d{2})/);
  const total = tM ? parseFloat(tM[1].replace(/,/g, "")) : 0;

  // Nombre del beat: lo que va entre comillas (ej. "CULPABLE$")
  const qM = text.match(/["“]([^"”]{2,})["”]/);
  const beat = qM ? qM[1].trim() : null;

  // Licencia: la línea que menciona "License/Licencia"
  const lM =
    text.match(/((?:basic|premium|unlimited|trackout|exclusive|pro)[^\n]*licen[^\n]*)/i) ||
    text.match(/(licen[^\n]*)/i);
  const licencia = lM ? lM[1].trim() : null;

  // Nombre del comprador: la línea no vacía justo antes del email
  let nombre: string | null = null;
  let direccion: string | null = null;
  if (email) {
    const idx = text.toLowerCase().indexOf(email);
    const prev = text.slice(0, idx).split("\n").map((s) => s.trim()).filter(Boolean);
    const cand = prev[prev.length - 1];
    if (cand && !/cliente|customer/i.test(cand) && cand.length < 60) nombre = cand;

    // Dirección: primera línea "de domicilio" justo DESPUÉS del email (bloque Cliente).
    const after = text.slice(idx + email.length).split("\n").map((s) => s.trim()).filter(Boolean);
    for (const line of after.slice(0, 3)) {
      if (/@/.test(line)) continue;                                  // otro correo
      if (/phone|tel[eé]?fono|celular|mobile|whats/i.test(line)) continue; // línea de teléfono
      if (/^\$|total|licen|order|receipt|beatstars|thank/i.test(line)) continue; // pie/venta
      if (/\d/.test(line) && /[a-záéíóúñ]/i.test(line) && line.length >= 8 && line.length <= 120) {
        direccion = line; break;
      }
    }
  }

  // Teléfono: solo si viene etiquetado o en formato internacional (+52…), para no
  // confundirlo con el CP ni con el número de la casa en la dirección.
  let telefono: string | null = null;
  const telM = text.match(/(?:phone|tel[eé]?fono|tel|celular|mobile|whats\w*)[^\d+]{0,12}([+]?\d[\d\s().-]{6,}\d)/i);
  if (telM) telefono = telM[1].replace(/[^\d+]/g, "");
  if (!telefono) {
    const intl = text.match(/\+\d[\d\s().-]{7,}\d/);
    if (intl) telefono = intl[0].replace(/[^\d+]/g, "");
  }

  // Tipo de venta (mapeado al estilo del sheet)
  let tipo = "Licencia (BeatStars)";
  if (licencia) {
    if (/exclusiv/i.test(licencia)) tipo = "Exclusividad";
    else if (/basic/i.test(licencia)) tipo = "Licencia básica";
    else if (/premium/i.test(licencia)) tipo = "Licencia premium";
    else tipo = licencia;
  }

  return { email, total, beat, licencia, nombre, tipo, direccion, telefono };
}

export async function POST(req: NextRequest) {
  const secret = process.env.BEATSTARS_EMAIL_SECRET;
  if (!secret) return NextResponse.json({ error: "No configurado" }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  if (!safeEqual(b.secret, secret)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!b.body) return NextResponse.json({ error: "Falta el cuerpo del correo" }, { status: 400 });

  const p = parseEmail(String(b.body));
  // Solo es venta si hay un total real (evita ventas fantasma de correos de
  // marketing u otros de BeatStars que traen correo pero no monto).
  if (!(p.total > 0)) {
    return NextResponse.json({ ok: true, skipped: "sin total (no es venta)", parsed: p });
  }

  const sb = supabaseAdmin();
  const idKey = String(b.messageId || Date.now()).replace(/[^A-Za-z0-9]/g, "").slice(-20);
  const folio = `BS-${idKey}`;
  const fecha = new Date().toISOString().slice(0, 10);

  // ── Contacto por email (llave fuerte en BeatStars) ──
  let contactoId: string | null = null;
  if (p.email) {
    const { data: ex } = await sb.from("contactos").select("id, nombre, telefono, direccion").eq("email", p.email).is("merged_into", null).limit(1);
    if (ex && ex[0]) {
      contactoId = ex[0].id;
      // Completa lo que falte, sin pisar datos ya existentes.
      const patch: Record<string, unknown> = {};
      if (p.nombre && !ex[0].nombre) patch.nombre = p.nombre;
      if (p.telefono && !ex[0].telefono) patch.telefono = p.telefono;
      if (p.direccion && !ex[0].direccion) patch.direccion = p.direccion;
      if (Object.keys(patch).length) await sb.from("contactos").update(patch).eq("id", contactoId);
    } else {
      const { data: nuevo } = await sb
        .from("contactos")
        .insert({ nombre: p.nombre, email: p.email, telefono: p.telefono, direccion: p.direccion, etapa: "cliente", origen: "beatstars" })
        .select("id")
        .single();
      contactoId = nuevo?.id ?? null;
    }
  }

  // ── Venta (idempotente por folio = messageId) ──
  // Se pregunta ANTES del upsert si ya existía: el upsert en sí es idempotente
  // (mismo folio, se pisa), pero sumar el escalón de fidelidad es un INCREMENTO
  // — si este correo se reprocesa (el Apps Script puede reintentar), sin esta
  // guardia el cliente subiría de nivel dos veces por la misma compra.
  const { data: yaExistia } = await sb.from("ventas").select("id").eq("folio", folio).maybeSingle();

  const FX = await getFX();
  const totalMxn = r2(p.total * FX);
  const { error } = await sb.from("ventas").upsert(
    {
      folio,
      fecha,
      contacto_id: contactoId,
      tipo: p.tipo,
      beat_nombre: p.beat,
      canal: "beatstars",
      moneda: "USD",
      monto_cobrado: p.total || null,
      tipo_cambio: FX,
      total_mxn: totalMxn,
      medio_pago: "BeatStars",
      quien_cerro: "BeatStars",
    },
    { onConflict: "folio" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Fidelidad: una licencia de BeatStars siempre se paga completa al
  //    instante — no existe el concepto de anticipo aquí — así que toda venta
  //    NUEVA suma un escalón. No lleva descuento propio ni genera crédito
  //    (eso es solo para cotizaciones "de contado"): solo cuenta para el nivel.
  if (!yaExistia) {
    await registrarPagoDeContado(sb, contactoId, totalMxn, { ventaId: null });
  }

  // ── Comisión (BeatStars + PayPal) registrada como EGRESO → la utilidad queda
  //    neta sin tocar el precio de venta. Idempotente por folio (BSC-{messageId}).
  const comision = r2(totalMxn * COMISION_PCT);
  if (comision > 0) {
    const egFolio = `BSC-${idKey}`;
    const egresoRow = {
      folio: egFolio,
      fecha,
      categoria: "Comisión BeatStars/PayPal",
      proveedor: "BeatStars/PayPal",
      descripcion: `Comisión de venta ${p.beat || folio} (${(COMISION_PCT * 100).toFixed(1)}%)`,
      total_mxn: comision,
      es_capex: false,
    };
    const { data: egEx } = await sb.from("egresos").select("id").eq("folio", egFolio).limit(1);
    if (egEx && egEx[0]) await sb.from("egresos").update(egresoRow).eq("id", egEx[0].id);
    else await sb.from("egresos").insert(egresoRow);
  }

  // ── Recalcula LTV/etapa del contacto ──
  if (contactoId) {
    const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
    const sum = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
    const n = (vts ?? []).length;
    await sb.from("contactos")
      .update({ ltv: sum, etapa: n > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() })
      .eq("id", contactoId);
  }

  return NextResponse.json({ ok: true, folio, parsed: { beat: p.beat, total: p.total, email: p.email, tipo: p.tipo, direccion: p.direccion, telefono: p.telefono } });
}
