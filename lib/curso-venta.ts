import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarPagoDeContado } from "@/lib/fidelidad-server";
import { comisionStripeMxn, registrarComisionStripeEgreso } from "@/lib/stripe-comision";
import { comisionIntlDeMeta, registrarComisionIntlIngreso } from "@/lib/comision-intl-server";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { pushAEmails } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { extenderVencimiento, leerConfig } from "@/lib/cursos-tipos";
import { bienvenidaCursoEmail, enviarCorreo } from "@/lib/emails-cursos";
import { revalidarSitio } from "@/lib/curso-lanzamiento";

/**
 * Pago confirmado de un curso o de un mes de mentoría (webhook de Stripe,
 * `metadata.tipo` = "curso" | "mentoria_mes"). Hace lo mismo que el resto de
 * las ventas del sitio — contacto, venta, fidelidad, comisiones — y además da
 * el acceso. Idempotente por el folio `CUR-<sesión>`: Stripe reintenta el
 * webhook y un mes de mentoría NO se debe extender dos veces.
 */
export async function handleCursoPago(stripe: Stripe, session: Stripe.Checkout.Session): Promise<NextResponse> {
  const meta = session.metadata ?? {};
  const cursoId = String(meta.curso_id ?? "");
  const email = String(meta.email || session.customer_details?.email || "").trim().toLowerCase();
  if (!cursoId || !email) return NextResponse.json({ received: true });

  const sb = supabaseAdmin();
  const { data: curso } = await sb.from("cursos").select("id, titulo, tipo, config").eq("id", cursoId).maybeSingle();
  if (!curso) return NextResponse.json({ received: true });
  const esMentoria = meta.tipo === "mentoria_mes";
  // Compró un lugar de fundador: no ve lecciones hasta el lanzamiento.
  const esPreventa = !esMentoria && meta.preventa === "1";

  const nombre = session.customer_details?.name ?? null;
  const telefono = session.customer_details?.phone ?? null;
  const comisionIntl = comisionIntlDeMeta(meta);
  const total = Math.round((((session.amount_total ?? 0) / 100) - comisionIntl) * 100) / 100;
  const folio = `CUR-${session.id}`;
  const fecha = new Date((session.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);

  const { data: ventaPrevia } = await sb.from("ventas").select("id").eq("folio", folio).maybeSingle();
  const yaProcesada = Boolean(ventaPrevia);

  // ── Contacto (CRM) ──
  let contactoId: string | null = null;
  try {
    const { data: ex } = await sb.from("contactos").select("id, nombre, telefono").eq("email", email).is("merged_into", null).limit(1);
    contactoId = (ex?.[0]?.id as string | undefined) ?? null;
    if (contactoId) {
      const patch: Record<string, string> = {};
      if (nombre && !ex![0].nombre) patch.nombre = nombre;
      if (telefono && !ex![0].telefono) patch.telefono = telefono;
      if (Object.keys(patch).length) await sb.from("contactos").update(patch).eq("id", contactoId);
    } else {
      const { data: nuevo } = await sb.from("contactos")
        .insert({ nombre, email, telefono, etapa: "cliente", origen: "sitio" }).select("id").single();
      contactoId = (nuevo?.id as string | undefined) ?? null;
    }
  } catch (e) {
    console.error("[curso-venta] contacto:", e);
  }

  // ── Venta ──
  let ventaId: string | null = (ventaPrevia?.id as string | undefined) ?? null;
  if (!yaProcesada) {
    const comisionMxn = await comisionStripeMxn(stripe, typeof session.payment_intent === "string" ? session.payment_intent : null, 1);
    const campos = {
      folio, fecha, contacto_id: contactoId,
      tipo: esMentoria ? "Mentoría" : "Curso",
      beat_nombre: esMentoria ? `${curso.titulo} · 1 mes` : esPreventa ? `${curso.titulo} (preventa)` : curso.titulo,
      canal: "sitio", moneda: "MXN", monto_cobrado: total, total_mxn: total,
      medio_pago: "Stripe", quien_cerro: "Sitio", comision_stripe_mxn: comisionMxn,
    };
    let r = await sb.from("ventas").upsert(campos, { onConflict: "folio" }).select("id").single();
    if (r.error) {
      const { comision_stripe_mxn: _omit, ...sinComision } = campos;
      r = await sb.from("ventas").upsert(sinComision, { onConflict: "folio" }).select("id").single();
    }
    ventaId = (r.data?.id as string | undefined) ?? null;
    if (r.error) console.error("[curso-venta] venta:", r.error.message);

    await registrarPagoDeContado(sb, contactoId, total, { ventaId });
    if (ventaId) await registrarComisionStripeEgreso(sb, ventaId, folio, fecha, comisionMxn);
    await registrarComisionIntlIngreso(sb, { sessionId: session.id, monto: comisionIntl, monedaPago: "MXN", fx: 1, folio, fecha });

    // LTV y etapa del contacto, igual que el resto de las ventas del sitio.
    if (contactoId) {
      const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
      const ltv = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
      await sb.from("contactos")
        .update({ ltv, etapa: (vts ?? []).length > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() })
        .eq("id", contactoId);
    }
  }

  // ── Acceso ──
  try {
    if (esMentoria) {
      // El acceso guarda la venta que lo extendió: si ya es ésta, el mes ya se sumó
      // (reintento de Stripe) y no se vuelve a sumar — aunque la venta se haya
      // creado en un intento anterior que falló antes de llegar aquí.
      const { data: acc } = await sb.from("curso_accesos").select("id, vence_en, venta_id").eq("curso_id", cursoId).eq("email", email).maybeSingle();
      const yaSumado = Boolean(ventaId && acc?.venta_id === ventaId);
      if (!yaSumado) {
        const vence = extenderVencimiento((acc?.vence_en as string | null) ?? null);
        if (acc) await sb.from("curso_accesos").update({ vence_en: vence, origen: "venta", venta_id: ventaId }).eq("id", acc.id);
        else await sb.from("curso_accesos").insert({ curso_id: cursoId, email, origen: "venta", venta_id: ventaId, vence_en: vence });
      }
    } else {
      await sb.from("curso_accesos").upsert(
        { curso_id: cursoId, email, origen: "venta", venta_id: ventaId },
        { onConflict: "curso_id,email", ignoreDuplicates: true },
      );
    }
  } catch (e) {
    console.error("[curso-venta] acceso:", e);
  }

  if (!yaProcesada) {
    const preventa = leerConfig(curso.config).preventa;
    if (!esMentoria) {
      await enviarCorreo(email, bienvenidaCursoEmail({
        nombre: nombre ? nombre.split(" ")[0] : null, curso: curso.titulo, cursoId,
        preventa: preventa.activa ? { lanzamiento: preventa.lanzamiento } : null,
      }));
    }
    await pushAEmails(sb, [...new Set([...adminEmails(), ...crmEmails()])], {
      titulo: esMentoria ? "🔁 Pagaron un mes de mentoría" : esPreventa ? "🎸 Vendiste un lugar de preventa" : "🎸 Vendiste el curso",
      cuerpo: `${curso.titulo} · $${total.toLocaleString("es-MX")} · ${email}`,
      url: "https://admin.aridomusicgroup.com/admin/cursos",
    });
    await registrarActividad(sb, {
      tipo: "curso_vendido",
      titulo: `${esMentoria ? "Mes de mentoría" : esPreventa ? "Preventa del curso" : "Curso"} “${curso.titulo}” a ${email} por Stripe`,
      entidad: "venta", entidad_id: ventaId, entidad_nombre: folio,
    });
    // “Quedan N lugares” en el inicio y en /cursos (la página del curso es dinámica).
    if (esPreventa) revalidarSitio();
  }
  return NextResponse.json({ received: true });
}
