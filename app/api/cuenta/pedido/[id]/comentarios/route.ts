import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { rateLimit } from "@/lib/rate-limit";
import { limpiarComentario, limpiarSegundo, paraCliente } from "@/lib/previo-comentarios";
import { registrarComentarioDePrevio } from "@/lib/previo-comentarios-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El cliente comenta un previo suyo.
 *
 * Cada comentario se convierte en una tarea del proyecto y queda en el
 * histórico (ver `registrarComentarioDePrevio`). Aquí sólo se decide si ESTA
 * persona puede comentar ESTE pedido y se limpia lo que escribió.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  // Dueño del pedido: el mismo candado que el resto del panel (incluye correos ligados).
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  if (!rateLimit(`comentario-previo:${email}`, 12, 10 * 60_000)) {
    return NextResponse.json({ error: "Muchos comentarios seguidos. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const jobId = String(b.jobId || "").trim();
  if (!UUID.test(jobId)) return NextResponse.json({ error: "Falta el previo." }, { status: 400 });

  const limpio = limpiarComentario(b.texto);
  if (!limpio.ok) return NextResponse.json({ error: limpio.error }, { status: 400 });

  const r = await registrarComentarioDePrevio({
    proyectoId: proy.proyectoId,
    proyectoTitulo: proy.titulo,
    email,
    jobId,
    texto: limpio.texto,
    segundo: limpiarSegundo(b.segundo),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, comentario: paraCliente(r.comentario) });
}
