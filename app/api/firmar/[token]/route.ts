import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACUERDO_VERSIONES, renderAcuerdo, validarFirma } from "@/lib/acuerdos/acuerdo-cliente";
import { getAcuerdoTexto } from "@/lib/acuerdos/server";
import { resolverInvitacion, sellarInvitacion } from "@/lib/acuerdos/invitaciones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ token: string }> };

/**
 * Firma pública, sin sesión: el TOKEN es la autorización, no un login.
 *
 * El correo y la familia salen de la invitación guardada en el servidor, NUNCA
 * del cuerpo de la petición — si vinieran del navegador, cualquiera con el
 * token de otra persona (o adivinando uno) podría firmar a nombre de un
 * correo distinto.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { token } = await params;
  const r = await resolverInvitacion(token);
  if (r.estado === "no_existe") return NextResponse.json({ error: "Enlace no válido." }, { status: 404 });
  if (r.estado === "vencida") return NextResponse.json({ error: "Este enlace ya venció." }, { status: 410 });
  if (r.estado === "usada") return NextResponse.json({ error: "Ese acuerdo ya se firmó con este enlace." }, { status: 409 });

  const { inv } = r;
  const b = await req.json().catch(() => ({}));
  const nombre = String(b?.nombre || "").trim();
  const problema = validarFirma(nombre);
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });
  if (b?.acepto !== true) {
    return NextResponse.json({ error: "Marca la casilla para aceptar el acuerdo." }, { status: 400 });
  }

  const { cuerpo } = await getAcuerdoTexto(inv.familia);
  const texto = renderAcuerdo(cuerpo, nombre);

  const { error } = await supabaseAdmin().from("cliente_acuerdos").upsert(
    {
      email: inv.email,
      familia: inv.familia,
      version: ACUERDO_VERSIONES[inv.familia],
      nombre,
      texto,
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

  await sellarInvitacion(inv.id);
  return NextResponse.json({ ok: true });
}
