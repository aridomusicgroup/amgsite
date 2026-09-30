import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCatalogoEstricto } from "@/lib/servicios-catalogo";
import { catalogoPublico } from "@/lib/servicios";
import { attribMetadata, type Attrib } from "@/lib/attribution-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { DOMAINS } from "@/lib/site";

/**
 * Stripe Checkout para el cotizador de servicios (MXN).
 * Valida todo contra el catálogo (tabla servicios_catalogo) — nunca se confía en precios del cliente.
 */

export async function POST(req: NextRequest) {
  if (!rateLimit(`checkoutsvc:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Checkout not enabled." }, { status: 503 });
  }

  let body: {
    baseId?: string | null;
    choices?: Record<string, string>;
    extras?: string[];
    studio?: string[];
    note?: string;
    lang?: string;
    attrib?: Attrib | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Sólo lo que hoy se vende: un paquete oculto no se puede pagar aunque alguien
  // mande su id a mano. Los precios salen de aquí, nunca del navegador.
  let services;
  try {
    services = catalogoPublico(await getCatalogoEstricto());
  } catch {
    // Mejor no cobrar que cobrar con precios que quizá ya cambiaron.
    return NextResponse.json({ error: "Catálogo no disponible, intenta en un momento." }, { status: 503 });
  }
  const lang = body.lang === "en" ? "en" : "es";
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const summary: string[] = [];

  // Paquete base
  if (body.baseId) {
    const base = services.bases.find((b) => b.id === body.baseId && b.id !== "scratch");
    if (!base) return NextResponse.json({ error: "Invalid base." }, { status: 400 });

    const choiceText = base.choices
      .map((c) => {
        const sel = body.choices?.[c.id] ?? c.options[0]?.id;
        const opt = c.options.find((o) => o.id === sel);
        return opt?.label[lang] ?? "";
      })
      .filter(Boolean)
      .join(", ");

    const name = base.name[lang] + (choiceText ? ` (${choiceText})` : "");
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: base.price * 100,
        product_data: { name },
      },
    });
    summary.push(name);

    // Instrumentos extra (solo válidos con paquete base y si no están incluidos)
    for (const exId of [...new Set(body.extras ?? [])]) {
      const ex = services.extras.find((e) => e.id === exId);
      if (!ex || base.includedExtras.includes(exId)) continue;
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: ex.price * 100,
          product_data: { name: `Extra: ${ex.label[lang]}` },
        },
      });
      summary.push(`+${ex.label[lang]}`);
    }
  }

  // Servicios de estudio
  for (const stId of [...new Set(body.studio ?? [])]) {
    const st = services.studio.find((s) => s.id === stId);
    if (!st) continue;
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: st.price * 100,
        product_data: { name: st.label[lang] },
      },
    });
    summary.push(st.label[lang]);
  }

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "Empty quote." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);
  const origin = DOMAINS.main; // dominio fijo, no confiar en el header Origin

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    phone_number_collection: { enabled: true },
    // Sin esto Stripe adivina el idioma del navegador y muchas veces cae en
    // inglés aunque el sitio (y casi todo el tráfico) sea en español — justo
    // el tipo de fricción de último segundo que tira ventas ya casi cerradas.
    locale: lang,
    success_url: `${origin}/cotizador/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cotizador`,
    metadata: {
      tipo: "servicios",
      resumen: summary.join(" | ").slice(0, 480),
      nota: (body.note ?? "").slice(0, 400),
      lang,
      ...attribMetadata(body.attrib),
    },
  });

  return NextResponse.json({ url: session.url });
}
