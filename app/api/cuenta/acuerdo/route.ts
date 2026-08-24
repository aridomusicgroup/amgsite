import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACUERDO_VERSIONES, renderAcuerdo, validarFirma, FAMILIAS } from "@/lib/acuerdos/acuerdo-cliente";
import { getAcuerdoTexto } from "@/lib/acuerdos/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El cliente acepta UN acuerdo (una familia de servicio).
 *
 * El texto que se guarda NO viene del navegador: se vuelve a leer aquí y se
 * arma en el servidor. Si se aceptara lo que manda el cliente, cualquiera
 * podría firmar un texto distinto al que se le mostró.
 */
export async function POST(req: NextRequest) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const familia = String(b?.familia || "");
  if (!(FAMILIAS as string[]).includes(familia)) {
    return NextResponse.json({ error: "Acuerdo inválido." }, { status: 400 });
  }
  const nombre = String(b?.nombre || "").trim();
  const problema = validarFirma(nombre);
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });
  if (b?.acepto !== true) {
    return NextResponse.json({ error: "Marca la casilla para aceptar el acuerdo." }, { status: 400 });
  }

  const { cuerpo } = await getAcuerdoTexto(familia as (typeof FAMILIAS)[number]);
  const texto = renderAcuerdo(cuerpo, nombre);

  const { error } = await supabaseAdmin().from("cliente_acuerdos").upsert(
    {
      email: email.toLowerCase(),
      familia,
      version: ACUERDO_VERSIONES[familia as (typeof FAMILIAS)[number]],
      nombre,
      texto,
      // Rastro mínimo por si alguna vez se discute quién aceptó y desde dónde.
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
      aceptado_at: new Date().toISOString(),
    },
    { onConflict: "email,familia,version" },
  );

  if (error) {
    const falta = /relation .* does not exist|schema cache|column .*familia/i.test(error.message);
    return NextResponse.json(
      { error: falta ? "Falta correr supabase-acuerdo-familias.sql en Supabase." : error.message },
      { status: falta ? 503 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
