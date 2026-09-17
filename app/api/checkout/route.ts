import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import rawLicenses from "@/data/licenses.json";
import { getCatalog } from "@/lib/catalog";
import { attribMetadata, type Attrib } from "@/lib/attribution-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isDirectExclusive, EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { DOMAINS } from "@/lib/site";
import { esPaisInternacional, montoComisionIntl, LABEL_COMISION_INTL } from "@/lib/comision-internacional";

/**
 * Stripe Checkout — direct beat sales.
 *
 * Disabled until STRIPE_SECRET_KEY is set in the environment AND
 * NEXT_PUBLIC_DIRECT_CHECKOUT="1" is set (shows the cart checkout button).
 * See STRIPE.md for activation steps.
 */

interface CheckoutItem {
  beatId: string;
  licenseId: string;
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Direct checkout is not enabled yet." },
      { status: 503 }
    );
  }

  let body: { items?: CheckoutItem[]; lang?: string; attrib?: Attrib | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const items = body.items ?? [];
  if (!items.length || items.length > 20) {
    return NextResponse.json({ error: "Invalid items." }, { status: 400 });
  }

  // Validate every item against server-side data — never trust client prices.
  // El catálogo completo (JSON + beats agregados desde el panel en Supabase) es
  // la única fuente de verdad; validar solo contra el JSON estático rechazaba
  // los beats nuevos y rompía su checkout.
  const { beats } = await getCatalog();
  const licenses = rawLicenses as Array<{
    id: string;
    price: number | null;
    exclusive: boolean;
    name: { es: string; en: string };
  }>;

  const lang = body.lang === "en" ? "en" : "es";
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  // La licencia exclusiva genera contrato → necesitamos el domicilio del comprador
  const hasExclusive = items.some((i) => i.licenseId === "exclusive");

  for (const item of items) {
    const beat = beats.find((b) => b.id === item.beatId);
    const license = licenses.find((l) => l.id === item.licenseId);
    if (!beat || !license) {
      return NextResponse.json(
        { error: `Invalid beat or license: ${item.beatId}/${item.licenseId}` },
        { status: 400 }
      );
    }
    // Precio efectivo: la exclusiva solo es compra directa ($600) en beats nuevos.
    // En beats legacy la exclusiva se negocia en BeatStars → no se permite por aquí.
    const price = license.exclusive
      ? isDirectExclusive(beat.id)
        ? EXCLUSIVE_DIRECT_PRICE
        : null
      : license.price;
    if (price === null) {
      return NextResponse.json(
        { error: `License not purchasable here: ${item.beatId}/${item.licenseId}` },
        { status: 400 }
      );
    }
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(price * 100),
        product_data: {
          name: beat.title, // CatalogBeat.title ya viene limpio
          description: license.name[lang],
          ...(beat.artworkUrl ? { images: [beat.artworkUrl] } : {}),
        },
      },
    });
  }

  // ── Comisión por pago internacional ──
  // La tienda cobra en USD a todos, así que lo que define si lleva comisión es
  // de dónde compra: el país lo dice Vercel (no el navegador, que se puede
  // manipular). Sin país conocido no se cobra.
  const pais = req.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  const subtotal = lineItems.reduce((a, li) => a + (li.price_data?.unit_amount ?? 0) / 100, 0);
  const comisionIntl = esPaisInternacional(pais) ? montoComisionIntl(subtotal) : 0;
  if (comisionIntl > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(comisionIntl * 100),
        product_data: { name: LABEL_COMISION_INTL[lang] },
      },
    });
  }

  const stripe = new Stripe(secretKey);
  const origin = DOMAINS.beats; // dominio fijo, no confiar en el header Origin

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    phone_number_collection: { enabled: true },
    // Sin esto Stripe adivina el idioma del navegador y muchas veces cae en
    // inglés aunque el sitio (y casi todo el tráfico) sea en español — justo
    // el tipo de fricción de último segundo que tira ventas ya casi cerradas.
    locale: lang,
    ...(hasExclusive
      ? { billing_address_collection: "required" as const }
      : {}),
    success_url: `${origin}/beats/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/beats`,
    metadata: {
      order: JSON.stringify(items),
      lang,
      // Para que la venta se registre por el precio real y la comisión se
      // guarde aparte como otro ingreso (ver el webhook).
      ...(comisionIntl > 0 ? { comision_intl: String(comisionIntl), pais: pais ?? "" } : {}),
      ...attribMetadata(body.attrib),
    },
  });

  return NextResponse.json({ url: session.url });
}
