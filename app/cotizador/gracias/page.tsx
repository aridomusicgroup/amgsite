import type { Metadata } from "next";
import Image from "next/image";
import Stripe from "stripe";
import { CheckCircle2 } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { CotizadorPurchaseTracker } from "@/components/arido/CotizadorPurchaseTracker";
import { SOCIALS } from "@/lib/site";

export const metadata: Metadata = {
  title: "¡Pedido recibido! — Árido Music Group",
  robots: { index: false },
};

async function getOrder(sessionId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    return {
      resumen: session.metadata?.resumen ?? "",
      total: session.amount_total ? session.amount_total / 100 : null,
    };
  } catch {
    return null;
  }
}

export default async function GraciasServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const order = session_id ? await getOrder(session_id) : null;

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-6 py-16">
      {order && session_id && (
        <CotizadorPurchaseTracker sessionId={session_id} total={order.total} resumen={order.resumen} />
      )}
      <div className="text-center max-w-lg w-full">
        <Image
          src="/logos/arido-color.png"
          alt="Árido Music Group"
          width={200}
          height={160}
          className="h-24 w-auto mx-auto object-contain mb-8 dark:hidden"
        />
        <Image
          src="/logos/arido-blanco.png"
          alt="Árido Music Group"
          width={200}
          height={160}
          className="h-24 w-auto mx-auto object-contain mb-8 hidden dark:block"
        />
        <CheckCircle2 size={56} className="text-green-500 mx-auto mb-6" />
        <h1 className="text-4xl font-coolvetica text-[var(--fg)] mb-4">
          ¡Pedido recibido!
        </h1>

        {order && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 mb-6 text-left">
            <p className="text-[var(--fg-2)] text-xs uppercase tracking-wider mb-2">
              Tu pedido
            </p>
            <p className="text-[var(--fg)] text-sm leading-relaxed">
              {order.resumen.split(" | ").join(" · ")}
            </p>
            {order.total !== null && (
              <p className="text-[var(--fg)] font-coolvetica text-2xl mt-3">
                ${order.total.toLocaleString("es-MX")}{" "}
                <span className="text-sm text-[var(--fg-2)] font-sans">MXN</span>
              </p>
            )}
          </div>
        )}

        <p className="text-[var(--fg-2)] leading-relaxed mb-6">
          Tu pago se procesó correctamente. Te contactamos en menos de 24 horas
          para arrancar tu proyecto.
        </p>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 mb-6 text-left">
          <p className="text-arido-red text-xs font-asphaltic uppercase tracking-wider mb-3">
            Mientras tanto, ve preparando:
          </p>
          <ul className="flex flex-col gap-2 text-sm text-[var(--fg-2)]">
            <li>📝 Tu letra (o la idea del tema)</li>
            <li>🎵 2-3 canciones de referencia del estilo que buscas</li>
            <li>🎸 La tonalidad si la sabes — o una nota de voz cantando</li>
          </ul>
          <p className="text-[var(--fg-2)] text-[11px] mt-4 leading-relaxed opacity-80">
            Tu servicio incluye 2 rondas de revisiones; ajustes adicionales se
            cotizan aparte. El tiempo de entrega se confirma al arrancar.
          </p>
        </div>

        <p className="text-[var(--fg-2)] text-sm leading-relaxed mb-8">
          ¿Quieres adelantar? Mándanos todo eso por WhatsApp de una vez.
        </p>

        <a
          href={SOCIALS.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#25D366] text-white px-8 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-all hover:scale-105"
        >
          <WhatsappIcon size={16} />
          Escribir por WhatsApp
        </a>
      </div>
    </main>
  );
}
