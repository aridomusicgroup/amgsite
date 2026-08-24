import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAResponsables } from "@/lib/push";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { getContactos, getRecompraMarcas } from "@/lib/erp-data";
import { candidatosRecompra } from "@/lib/recompra";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Recordatorio semanal de recompra.
 *
 * NO agenda nada solo: la bandeja de /admin/clientes ya calcula en vivo a quién
 * toca. Este cron solo evita que se olvide — un push el lunes con cuántos
 * clientes están listos y cuánto valen. La decisión (escribirle o descartarlo)
 * siempre la toma una persona.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [contactos, marcas] = await Promise.all([getContactos(), getRecompraMarcas()]);
  const cand = candidatosRecompra(contactos, marcas);
  if (cand.length === 0) return NextResponse.json({ ok: true, candidatos: 0 });

  const valor = cand.reduce((a, k) => a + k.c.ltv, 0);
  const tibios = cand.filter((k) => k.temperatura === "tibio").length;

  const sb = supabaseAdmin();
  const correos = [...new Set([...adminEmails(), ...crmEmails()].map((e) => e.toLowerCase()))];
  const { data: eq } = await sb.from("equipo").select("id, email").eq("activo", true);
  const ids = (eq ?? [])
    .filter((p) => p.email && correos.includes(String(p.email).toLowerCase()))
    .map((p) => p.id as string);

  const top = cand[0];
  await pushAResponsables(sb, ids, {
    titulo: `🔁 ${cand.length} clientes listos para recomprar`,
    cuerpo:
      `${peso(valor)} ya comprados entre todos${tibios > 0 ? ` · ${tibios} en su mejor momento` : ""}. ` +
      `Empieza por ${top.c.nombre || "el de arriba"}.`,
    url: "https://admin.aridomusicgroup.com/admin/clientes",
  });

  return NextResponse.json({ ok: true, candidatos: cand.length, tibios, valor, avisados: ids.length });
}
