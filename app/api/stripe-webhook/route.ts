import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  customerOrderEmail,
  internalOrderEmail,
  customerContractEmail,
  internalContractEmail,
} from "@/lib/emails";
import { SOCIALS } from "@/lib/site";
import rawBeats from "@/data/beats-beatstars.json";
import rawLicenses from "@/data/licenses.json";
import { cleanTitle } from "@/lib/beatstars";
import { generateExclusiveContract } from "@/lib/contract";
import { generateLicenseCertificate } from "@/lib/license";
import { getBeatMeta } from "@/lib/beat-drive";
import { registrarPagoDeContado } from "@/lib/fidelidad-server";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { pushAEmails } from "@/lib/push";
import { tramosConEstado, siguientePendiente } from "@/lib/cotizacion-pagos";
import { esEsquemaValido, type EsquemaPago } from "@/lib/esquema-pago";
import { crearVentaDesdeCotizacionPagada } from "@/lib/venta-desde-cotizacion";
import { comisionStripeMxn, registrarComisionStripeEgreso } from "@/lib/stripe-comision";

/**
 * Webhook de Stripe (Fase A del Sistema ARIDO):
 * checkout.session.completed → guarda cliente+pedido en Supabase y manda
 * correo de confirmación al cliente + aviso interno.
 *
 * Env vars necesarias (cada pieza se activa al existir su llave):
 *  STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 */

const beats = rawBeats as Array<{ id: string; title: string }>;

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !whSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const stripe = new Stripe(secretKey);
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, whSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  // ── Pago de un tramo de cotización (plan de pagos por link de Stripe) ──
  // Nada que ver con el flujo de pedidos del sitio (beats/servicios) de aquí
  // abajo: registra el pago en su propio ledger y crea/actualiza la venta
  // sola, desde el primer tramo que llegue (ver handleCotizacionPago).
  if (session.metadata?.tipo === "cotizacion_pago") {
    return handleCotizacionPago(stripe, session);
  }

  // Conceptos del pedido
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 30 });
  const items = lineItems.data.map((li) => ({
    description: li.description ?? "Concepto",
    amount: (li.amount_total ?? 0) / 100,
    quantity: li.quantity ?? 1,
  }));

  const meta = session.metadata ?? {};
  const lang: "es" | "en" = meta.lang === "en" ? "en" : "es";
  const type: "beat" | "servicio" = meta.tipo === "servicios" ? "servicio" : "beat";
  // Normalizado a minúsculas: el login y "Mis compras" buscan por email en minúsculas
  const email = (session.customer_details?.email ?? "").toLowerCase();
  const name = session.customer_details?.name ?? null;
  const phone = session.customer_details?.phone ?? null;
  const total = (session.amount_total ?? 0) / 100;
  const currency = session.currency ?? "mxn";
  const note = meta.nota || null;
  const summary =
    meta.resumen || (meta.order ? items.map((i) => i.description).join(" | ") : null);

  // ── 1) Guardar en Supabase ──────────────────────────────────
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl && sbKey && email) {
    try {
      const sb = createClient(sbUrl, sbKey);

      const { data: customer } = await sb
        .from("customers")
        .upsert(
          { email, name: name ?? undefined, phone: phone ?? undefined },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      const { data: order } = await sb
        .from("orders")
        .upsert(
          {
            stripe_session_id: session.id,
            customer_id: customer?.id ?? null,
            type,
            status: "nuevo",
            total,
            currency: currency.toUpperCase(),
            summary,
            note,
            utm_source: meta.utm_source || null,
            utm_medium: meta.utm_medium || null,
            utm_campaign: meta.utm_campaign || null,
            referrer: meta.referrer || null,
            landing: meta.landing || null,
            lang: meta.lang || "es",
          },
          { onConflict: "stripe_session_id" }
        )
        .select("id")
        .single();

      if (order?.id) {
        await sb.from("order_items").delete().eq("order_id", order.id);
        await sb.from("order_items").insert(
          items.map((i) => ({
            order_id: order.id,
            description: i.description,
            amount: i.amount,
            quantity: i.quantity,
          }))
        );
      }

      // ── ERP: contacto + venta (CRM / Dashboard / reparto) ───────
      // Aditivo y aislado: las ventas del sitio caen en las tablas nuevas
      // igual que WhatsApp/BeatStars. Idempotente por el ID de sesión de Stripe.
      try {
        const { data: ex } = await sb
          .from("contactos")
          .select("id, nombre, telefono")
          .eq("email", email)
          .is("merged_into", null)
          .limit(1);
        let contactoId = ex?.[0]?.id ?? null;
        if (contactoId) {
          const patch: Record<string, string> = {};
          if (name && !ex![0].nombre) patch.nombre = name;
          if (phone && !ex![0].telefono) patch.telefono = phone;
          if (Object.keys(patch).length) await sb.from("contactos").update(patch).eq("id", contactoId);
        } else {
          const { data: nuevo } = await sb
            .from("contactos")
            .insert({ nombre: name, email, telefono: phone, etapa: "cliente", origen: "sitio" })
            .select("id")
            .single();
          contactoId = nuevo?.id ?? null;
        }

        const FX = 18; // USD→MXN aprox, para unificar métricas con el resto del ERP
        const totalMxn = currency.toLowerCase() === "usd" ? total * FX : total;
        // Best-effort: nunca bloquea la venta si Stripe no responde a tiempo.
        const comisionMxn = await comisionStripeMxn(stripe, typeof session.payment_intent === "string" ? session.payment_intent : null, FX);
        // Stripe puede reintentar el webhook — se pregunta ANTES del upsert si
        // esta venta ya existía, para no sumarle el escalón de fidelidad dos
        // veces por el mismo pago (el upsert en sí sí es idempotente).
        const ventaFolio = `WEB-${session.id}`;
        const { data: ventaYaExistia } = await sb.from("ventas").select("id").eq("folio", ventaFolio).maybeSingle();
        const camposVenta = {
          folio: ventaFolio,
          fecha: new Date((session.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
          contacto_id: contactoId,
          tipo: type === "servicio" ? "Servicio" : "Licencia (sitio)",
          beat_nombre: summary,
          canal: "sitio",
          moneda: currency.toUpperCase(),
          monto_cobrado: total,
          tipo_cambio: currency.toLowerCase() === "usd" ? FX : null,
          total_mxn: totalMxn,
          medio_pago: "Stripe",
          quien_cerro: "Sitio",
          comision_stripe_mxn: comisionMxn,
        };
        let ventaRes = await sb.from("ventas").upsert(camposVenta, { onConflict: "folio" }).select("id").single();
        if (ventaRes.error) {
          // Probablemente falta la columna (SQL de comisión Stripe sin correr) — reintenta sin ella.
          const { comision_stripe_mxn: _omit, ...sinComision } = camposVenta;
          ventaRes = await sb.from("ventas").upsert(sinComision, { onConflict: "folio" }).select("id").single();
        }
        const ventaId = ventaRes.data?.id ?? null;

        // ── Fidelidad: el checkout de Stripe SIEMPRE cobra el 100% al momento
        //    (no existe anticipo en este flujo) → toda venta NUEVA suma un
        //    escalón. Sin descuento propio ni crédito — eso es solo para
        //    cotizaciones "de contado" (fase B/C).
        if (!ventaYaExistia) {
          await registrarPagoDeContado(sb, contactoId, totalMxn, { ventaId });
          if (ventaId) await registrarComisionStripeEgreso(sb, ventaId, ventaFolio, camposVenta.fecha, comisionMxn);
        }

        if (contactoId) {
          const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
          const sum = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
          const n = (vts ?? []).length;
          await sb
            .from("contactos")
            .update({ ltv: sum, etapa: n > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() })
            .eq("id", contactoId);
        }

        // ── Producción: crea un proyecto para los SERVICIOS del sitio (los beats se
        //    entregan solos y no requieren producción). Idempotente por order_id.
        if (type === "servicio" && order?.id) {
          try {
            const { data: exP } = await sb.from("proyectos").select("id").eq("order_id", order.id).limit(1);
            if (!exP || !exP[0]) {
              const { data: ult } = await sb.from("proyectos").select("folio").like("folio", "P%").order("folio", { ascending: false }).limit(1);
              let pn = 0;
              const pv = ult?.[0]?.folio as string | undefined;
              if (pv) { const m = parseInt(pv.replace(/\D/g, ""), 10); if (!isNaN(m)) pn = m; }
              await sb.from("proyectos").insert({
                folio: "P" + String(pn + 1).padStart(4, "0"),
                clase: "produccion", titulo: summary || "Pedido del sitio", tipo: "grabacion",
                estado: "cola", prioridad: "media",
                contacto_id: contactoId, venta_id: ventaId, order_id: order.id, creado_por: "sitio",
              });
            }
          } catch (e) {
            console.error("Proyecto auto (sitio) failed:", e);
          }
        }
      } catch (e) {
        console.error("ERP venta/contacto failed:", e);
      }
    } catch (e) {
      console.error("Supabase insert failed:", e);
    }
  }

  // ── 2) Correos vía Resend ───────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && email) {
    try {
      const resend = new Resend(resendKey);
      const from = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

      // Links de descarga + certificados de licencia (licencias NO exclusivas)
      const downloads: { title: string; url: string }[] = [];
      const certs: { filename: string; content: Buffer }[] = [];
      const lics = rawLicenses as Array<{
        id: string; badge: string; price: number | null; exclusive: boolean;
        files: string[]; name: { es: string; en: string };
        features: { es: string[]; en: string[] }; notIncluded: { es: string[]; en: string[] };
      }>;
      if (type === "beat" && meta.order) {
        try {
          const order: { beatId: string; licenseId: string }[] = JSON.parse(meta.order);
          let n = 0;
          for (const it of order) {
            const beatMeta = await getBeatMeta(it.beatId);
            const license = lics.find((l) => l.id === it.licenseId);
            const bt = beatMeta ? cleanTitle(beatMeta.title) : "";
            if (beatMeta?.driveFolderId && bt) {
              const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
              const sub = beatMeta.subfolders;
              if (license && !license.exclusive && sub) {
                // Solo las carpetas que incluye la licencia comprada (Basic=MP3, Premium=WAV+MP3…)
                let added = 0;
                for (const ft of license.files) {
                  const id = sub[ft.toUpperCase()];
                  if (id) {
                    downloads.push({ title: `⬇ ${ft.toUpperCase()} — ${bt.slice(0, 42)}`, url: folderUrl(id) });
                    added++;
                  }
                }
                // Si faltara alguna subcarpeta, no dejar al cliente sin descarga
                if (!added) downloads.push({ title: `⬇ ${bt.slice(0, 55)}`, url: folderUrl(beatMeta.driveFolderId) });
              } else {
                // Exclusiva (o beat sin subcarpetas): carpeta general con TODOS los archivos
                downloads.push({ title: `⬇ ${bt.slice(0, 46)} — Todos los archivos`, url: folderUrl(beatMeta.driveFolderId) });
              }
            }
            // Certificado de licencia para las licencias no exclusivas
            if (bt && license && !license.exclusive) {
              try {
                const exLine = items.find((i) => i.description === bt);
                const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                const folio = `LIC-${ymd}-${session.id.slice(-6).toUpperCase()}${n > 0 ? `-${n + 1}` : ""}`;
                const pdf = await generateLicenseCertificate({
                  buyerName: name ?? email,
                  buyerEmail: email,
                  beatTitle: bt,
                  licenseLabel: license.name[lang],
                  badge: license.badge,
                  price: exLine?.amount ?? license.price ?? 0,
                  currency,
                  features: license.features[lang],
                  notIncluded: license.notIncluded[lang],
                  files: license.files,
                  folio,
                  lang,
                });
                certs.push({
                  filename: `Licencia ${license.name[lang]} - ${bt}.pdf`.replace(/[\\/:*?"<>|]/g, ""),
                  content: Buffer.from(pdf),
                });
                n++;
              } catch (e) {
                console.error("License cert failed:", e);
              }
            }
          }
        } catch {
          /* metadata.order inválida */
        }
      }

      const customerMail = customerOrderEmail({
        customerName: name ? name.split(" ")[0] : null,
        items,
        total,
        currency,
        type,
        downloads,
        note,
      });
      await resend.emails.send({
        from,
        to: email,
        subject: customerMail.subject,
        html: customerMail.html,
        ...(certs.length ? { attachments: certs } : {}),
      });

      const internalMail = internalOrderEmail({
        email,
        phone,
        name,
        items,
        total,
        currency,
        type,
        note,
        source: meta.utm_source || null,
      });
      await resend.emails.send({
        from,
        to: SOCIALS.email,
        subject: internalMail.subject,
        html: internalMail.html,
      });

      // ── 3) Contrato de exclusividad (solo licencia "exclusive") ──
      try {
        const order: { beatId: string; licenseId: string }[] = meta.order
          ? JSON.parse(meta.order)
          : [];
        const ex = order.find((o) => o.licenseId === "exclusive");
        if (ex) {
          const beat = beats.find((b) => b.id === ex.beatId);
          const beatTitle = beat ? cleanTitle(beat.title) : summary ?? "Instrumental";
          const exLine = items.find(
            (i) => beat && cleanTitle(beat.title) === i.description
          );
          const exclusiveLicense = (
            rawLicenses as Array<{ id: string; price: number | null }>
          ).find((l) => l.id === "exclusive");
          const price = exLine?.amount ?? exclusiveLicense?.price ?? total;
          const a = session.customer_details?.address;
          const buyerAddress = a
            ? [a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
                .filter(Boolean)
                .join(", ")
            : "—";

          const pdfBytes = await generateExclusiveContract({
            buyerName: name ?? email,
            buyerAddress,
            buyerPhone: phone ?? "—",
            buyerEmail: email,
            beatTitle,
            price,
            currency,
          });
          const attachment = {
            filename: `Contrato Exclusividad - ${beatTitle}.pdf`.replace(
              /[\\/:*?"<>|]/g,
              ""
            ),
            content: Buffer.from(pdfBytes),
          };
          const contractMail = customerContractEmail({
            customerName: name ? name.split(" ")[0] : null,
            beatTitle,
          });
          await resend.emails.send({
            from,
            to: email,
            subject: contractMail.subject,
            html: contractMail.html,
            attachments: [attachment],
          });
          const internalContract = internalContractEmail({ name, email, beatTitle });
          await resend.emails.send({
            from,
            to: SOCIALS.email,
            subject: internalContract.subject,
            html: internalContract.html,
            attachments: [attachment],
          });
        }
      } catch (e) {
        console.error("Contract generation/send failed:", e);
      }
    } catch (e) {
      console.error("Resend send failed:", e);
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Registra el pago de un tramo de cotización, crea/actualiza la venta sola
 * (ver crearVentaDesdeCotizacionPagada) y avisa al staff. Idempotente por
 * `stripe_session_id` (Stripe reintenta el webhook) — si ya está registrado,
 * no vuelve a insertar ni a mandar el push.
 */
async function handleCotizacionPago(stripe: Stripe, session: Stripe.Checkout.Session): Promise<NextResponse> {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const meta = session.metadata ?? {};
  const cotizacionId = meta.cotizacion_id;
  if (!sbUrl || !sbKey || !cotizacionId) return NextResponse.json({ received: true });

  try {
    const sb = createClient(sbUrl, sbKey);

    const { data: yaRegistrado } = await sb
      .from("cotizacion_pagos")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (yaRegistrado) return NextResponse.json({ received: true });

    const monto = (session.amount_total ?? 0) / 100;
    const tramoIndex = Number(meta.tramo_index);
    // Best-effort: la cuenta de Stripe liquida en MXN casi siempre, así que el
    // fallback de tipo de cambio (18) rara vez se usa de verdad — ver comisionStripeMxn.
    const comisionMxn = await comisionStripeMxn(stripe, typeof session.payment_intent === "string" ? session.payment_intent : null, 18);

    const { data: cot } = await sb
      .from("cotizaciones")
      .select("folio, cliente_nombre, esquema_pago, total, num_canciones")
      .eq("id", cotizacionId)
      .single();

    await sb.from("cotizacion_pagos").insert({
      cotizacion_id: cotizacionId,
      tramo_index: Number.isFinite(tramoIndex) ? tramoIndex : 0,
      tramo_label: meta.tramo_label || null,
      monto,
      moneda: (session.currency ?? "mxn").toUpperCase(),
      stripe_session_id: session.id,
      pagado_at: new Date().toISOString(),
    });

    const quien = cot?.cliente_nombre ? `${cot.cliente_nombre} · ` : "";
    const folio = (cot?.folio as string | null) ?? "";
    const correos = [...new Set([...adminEmails(), ...crmEmails()])];

    // Con cuánto se pagó de más queda la cotización DESPUÉS de este tramo —
    // solo para elegir el texto del aviso, no para decidir si se crea la venta.
    let yaEstaCompleta = false;
    if (cot) {
      const esquema: EsquemaPago = esEsquemaValido(cot.esquema_pago) ? cot.esquema_pago : "estandar";
      const tramos = await tramosConEstado(sb, cotizacionId, esquema, Number(cot.total) || 0, cot.num_canciones);
      yaEstaCompleta = !siguientePendiente(tramos);
    }

    // Cualquier tramo pagado (aunque sea solo el anticipo) crea la venta sola
    // — ver crearVentaDesdeCotizacionPagada. Es idempotente: en tramos
    // posteriores solo suma el pago a la venta que ya existe.
    const resultado = await crearVentaDesdeCotizacionPagada(sb, cotizacionId, monto, comisionMxn);
    if (resultado) {
      await registrarComisionStripeEgreso(sb, resultado.ventaId, resultado.ventaFolio, new Date().toISOString().slice(0, 10), comisionMxn, meta.tramo_label || null);
    }

    if (resultado && !resultado.yaExistia) {
      const detalleProyecto = resultado.proyectoCreado
        ? `Proyecto ${resultado.proyectoFolio} creado.`
        : "Falta armar el proyecto a mano.";
      const detallePago = yaEstaCompleta
        ? "Se pagó de una sola vez."
        : `Fue ${meta.tramo_label || "el primer tramo"}; falta el resto por cobrar.`;
      await pushAEmails(sb, correos, {
        titulo: `✅ Venta creada sola — ${resultado.ventaFolio}`,
        cuerpo: `${quien}${folio} generó venta. ${detallePago} ${detalleProyecto}`,
        url: `https://admin.aridomusicgroup.com/admin/ventas`,
      });
    } else if (resultado && yaEstaCompleta) {
      await pushAEmails(sb, correos, {
        titulo: `🎉 Cotización pagada por completo — ${folio}`,
        cuerpo: `${quien}se terminó de cobrar ${resultado.ventaFolio}.`,
        url: `https://admin.aridomusicgroup.com/admin/ventas`,
      });
    } else if (resultado) {
      await pushAEmails(sb, correos, {
        titulo: `💰 Pago recibido — ${folio}`,
        cuerpo: `${quien}${meta.tramo_label || "un tramo"} · $${monto.toLocaleString("es-MX")} ${(session.currency ?? "mxn").toUpperCase()}. Falta el resto de los tramos.`,
        url: `https://admin.aridomusicgroup.com/admin/cotizaciones`,
      });
    } else {
      // No se pudo crear/registrar la venta sola (dato faltante, error) —
      // mismo aviso de siempre para que el staff la convierta a mano.
      await pushAEmails(sb, correos, {
        titulo: `💰 Pago recibido — ${folio}`,
        cuerpo: `${quien}se recibió un pago pero no se pudo crear/actualizar la venta sola. Revísalo a mano.`,
        url: `https://admin.aridomusicgroup.com/admin/cotizaciones`,
      });
    }
  } catch (e) {
    console.error("cotizacion_pago webhook failed:", e);
  }

  return NextResponse.json({ received: true });
}
