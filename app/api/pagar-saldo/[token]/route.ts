import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saldoDeVenta, linkDeSaldo } from "@/lib/cobranza";
import { ventaDeToken } from "@/lib/pago-token";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ token: string }> };

/**
 * El botón "Pagar y descargar" del correo y del panel del cliente.
 *
 * Arma el cobro de Stripe EN EL MOMENTO del clic, por el saldo de ese instante:
 * un link de Stripe dentro del correo caducaría en 24 horas, y quien lo abre
 * al día siguiente es justo quien ya decidió pagar. Si ya no debe nada (pagó
 * por transferencia entre tanto), lo manda a su cuenta en vez de cobrarle.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { token } = await params;
  const cuenta = `${DOMAINS.main}/cuenta`;

  const ventaId = ventaDeToken(token);
  if (!ventaId) return NextResponse.redirect(cuenta, 303);

  const s = await saldoDeVenta(supabaseAdmin(), ventaId);
  if (!s || s.saldo <= 0.5) return NextResponse.redirect(cuenta, 303);

  const url = await linkDeSaldo({ ventaId, folio: s.folio, concepto: s.concepto, saldo: s.saldo });
  return NextResponse.redirect(url ?? cuenta, 303);
}
