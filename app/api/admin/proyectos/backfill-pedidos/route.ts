import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { crearPedidoDeProyecto, TIPOS_NO_CLIENTE } from "@/lib/pedido-sync";
import { clienteAccesoEmail } from "@/lib/emails";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Solo avisamos al cliente si su proyecto sigue EN CURSO (avance en vivo).
const ESTADOS_ACTIVOS = ["produccion", "revision"];

/**
 * Backfill: enlaza un "pedido" (order) a cada proyecto de PRODUCCIÓN de CLIENTE
 * que aún no lo tiene, para que el cliente lo vea en /cuenta. Idempotente y
 * seguro de correr varias veces. Excluye contenido propio, beats y tareas
 * internas. Avisa por correo solo a los proyectos activos (producción/revisión).
 * Solo admin total.
 */
export async function POST() {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = supabaseAdmin();

  const { data: proys, error } = await sb
    .from("proyectos")
    .select("id, titulo, estado, clase, tipo, order_id, contacto_id")
    .eq("clase", "produccion")
    .is("order_id", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Solo proyectos de cliente (fuera contenido / beats / interno).
  const candidatos = (proys ?? []).filter(
    (p: { tipo: string | null }) => !TIPOS_NO_CLIENTE.includes(String(p.tipo ?? ""))
  );

  const enlazados: string[] = [];
  const avisados: string[] = [];
  const sinCorreo: string[] = [];
  const sinContacto: string[] = [];

  for (const p of candidatos) {
    if (!p.contacto_id) {
      sinContacto.push(p.titulo);
      continue;
    }
    const { data: ct } = await sb
      .from("contactos")
      .select("nombre, email")
      .eq("id", p.contacto_id)
      .single();
    const email = String(ct?.email || "").trim().toLowerCase();
    if (!email) {
      sinCorreo.push(p.titulo);
      continue;
    }

    // Enlaza (idempotente). Puede fallar en silencio si algo raro; confirmamos.
    await crearPedidoDeProyecto(sb, p.id);
    const { data: check } = await sb.from("proyectos").select("order_id").eq("id", p.id).single();
    if (!check?.order_id) {
      sinCorreo.push(p.titulo);
      continue;
    }
    enlazados.push(p.titulo);

    // Aviso SOLO a proyectos activos y solo si Resend está configurado.
    if (ESTADOS_ACTIVOS.includes(String(p.estado)) && process.env.RESEND_API_KEY) {
      try {
        const { subject, html } = clienteAccesoEmail({
          customerName: (ct?.nombre as string) || null,
          concepto: p.titulo,
          url: `${DOMAINS.main}/cuenta/login`,
        });
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
          to: email,
          subject,
          html,
        });
        avisados.push(email);
      } catch {
        /* no romper el backfill si el correo falla */
      }
    }
  }

  return NextResponse.json({
    ok: true,
    resumen: {
      enlazados: enlazados.length,
      avisados: avisados.length,
      sinCorreo: sinCorreo.length,
      sinContacto: sinContacto.length,
    },
    enlazados,
    avisados,
    sinCorreo,
    sinContacto,
  });
}
