import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { leerConfig } from "@/lib/cursos-tipos";
import { attribMetadata, type Attrib } from "@/lib/attribution-server";
import { esPaisInternacional, montoComisionIntl, LABEL_COMISION_INTL } from "@/lib/comision-internacional";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Stripe Checkout (MXN, pago único) para:
 *  - `modo: "curso"`         comprar un curso desde su página de venta.
 *  - `modo: "mentoria_mes"`  pagar un mes de la mentoría (sólo si está “abierta”).
 * El precio SIEMPRE sale de la base de datos, nunca del navegador. El acceso lo
 * da el webhook al confirmarse el pago (ver lib/curso-venta.ts).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`checkoutcurso:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "El pago en línea no está disponible todavía." }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as { curso_id?: string; modo?: string; attrib?: Attrib | null };
  const cursoId = String(b.curso_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(cursoId)) return NextResponse.json({ error: "Curso inválido." }, { status: 400 });
  const modo = b.modo === "mentoria_mes" ? "mentoria_mes" : "curso";

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("cursos").select("id, slug, titulo, precio_mxn, activo, tipo").eq("id", cursoId).maybeSingle();
  if (!c) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });

  let precio = 0;
  let nombre = String(c.titulo);
  let regreso = `${DOMAINS.main}/cursos/${c.slug}`;
  let exito = `${DOMAINS.main}/cursos/${c.slug}/gracias?session_id={CHECKOUT_SESSION_ID}`;
  const email = await getCustomerEmail();

  if (modo === "curso") {
    if (c.tipo === "mentoria" || !c.activo) return NextResponse.json({ error: "Este curso no está a la venta." }, { status: 400 });
    precio = Number(c.precio_mxn) || 0;
  } else {
    // El precio y el interruptor viven en el curso que liga a esta mentoría.
    if (c.tipo !== "mentoria") return NextResponse.json({ error: "No es una mentoría." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Entra a tu cuenta para pagar tu mes." }, { status: 401 });
    const { data: cursos } = await sb.from("cursos").select("id, config").eq("tipo", "curso");
    const origen = (cursos ?? []).find((x) => leerConfig(x.config).mentoria.curso_id === cursoId);
    const cfg = origen ? leerConfig(origen.config).mentoria : null;
    if (!origen || !cfg || cfg.estado !== "abierta") return NextResponse.json({ error: "La mentoría no está abierta todavía." }, { status: 400 });
    precio = cfg.precio_mes ?? 0;
    nombre = `${c.titulo} · 1 mes`;
    regreso = `${DOMAINS.main}/cuenta/curso/${origen.id}`;
    exito = `${DOMAINS.main}/cuenta/curso/${origen.id}?mentoria=ok`;
  }
  if (!(precio > 0)) return NextResponse.json({ error: "Todavía no tiene precio en línea. Escríbenos por WhatsApp." }, { status: 400 });

  const lineas: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { quantity: 1, price_data: { currency: "mxn", unit_amount: Math.round(precio * 100), product_data: { name: nombre } } },
  ];
  // Misma regla que la tienda: de fuera de México se cobra la comisión (país según Vercel).
  const pais = req.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  const comisionIntl = esPaisInternacional(pais) ? montoComisionIntl(precio) : 0;
  if (comisionIntl > 0) {
    lineas.push({ quantity: 1, price_data: { currency: "mxn", unit_amount: Math.round(comisionIntl * 100), product_data: { name: LABEL_COMISION_INTL.es } } });
  }

  const session = await new Stripe(secretKey).checkout.sessions.create({
    mode: "payment",
    line_items: lineas,
    locale: "es",
    phone_number_collection: { enabled: true },
    ...(email ? { customer_email: email } : {}),
    success_url: exito,
    cancel_url: regreso,
    metadata: {
      tipo: modo,
      curso_id: cursoId,
      ...(email ? { email } : {}),
      lang: "es",
      ...(comisionIntl > 0 ? { comision_intl: String(comisionIntl), pais: pais ?? "" } : {}),
      ...attribMetadata(b.attrib),
    },
  });
  return NextResponse.json({ url: session.url });
}
