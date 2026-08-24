import type { Metadata } from "next";

import Image from "next/image";
import Stripe from "stripe";
import { CheckCircle2, FolderDown, Clock, Mail } from "lucide-react";
import rawBeats from "@/data/beats-beatstars.json";
import rawLicenses from "@/data/licenses.json";
import driveLinks from "@/data/drive-links.json";
import { overridesCarpetas } from "@/lib/beat-carpetas";
import { cleanTitle } from "@/lib/beatstars";
import { SOCIALS } from "@/lib/site";
import { PurchaseTracker } from "@/components/lgb/PurchaseTracker";

export const metadata: Metadata = {
  title: "¡Gracias por tu compra! — Latino Gang Beats",
  robots: { index: false },
  icons: {
    icon: "/icon-lgb.png",
    apple: "/apple-icon-lgb.png",
  },
};

interface OrderItem {
  beatId: string;
  licenseId: string;
}

interface Delivery {
  title: string;
  licenseName: string;
  files: string;
  driveUrl: string | null;
}

const beats = rawBeats as Array<{ id: string; title: string }>;
const licenses = rawLicenses as Array<{
  id: string;
  files: string[];
  name: { es: string; en: string };
}>;
const links = driveLinks as Record<string, { driveFolderId: string }>;

interface Resumen {
  items: Delivery[];
  total: number;
  order: OrderItem[];
}

async function getDeliveries(sessionId: string): Promise<Resumen | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    const order: OrderItem[] = JSON.parse(session.metadata?.order ?? "[]");
    // La carpeta corregida a mano gana: si el link automático estaba mal, el
    // cliente que acaba de pagar es justo el que no puede recibir la equivocada.
    const manual = await overridesCarpetas();
    const items = order.map((item) => {
      const beat = beats.find((b) => b.id === item.beatId);
      const license = licenses.find((l) => l.id === item.licenseId);
      const link = manual.get(item.beatId) ?? links[item.beatId];
      return {
        title: beat ? cleanTitle(beat.title) : item.beatId,
        licenseName: license?.name.es ?? item.licenseId,
        files: license?.files.join(" + ") ?? "",
        driveUrl: link
          ? `https://drive.google.com/drive/folders/${link.driveFolderId}`
          : null,
      };
    });
    return { items, total: (session.amount_total ?? 0) / 100, order };
  } catch {
    return null;
  }
}

export default async function GraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const resumen = session_id ? await getDeliveries(session_id) : null;
  const deliveries = resumen?.items ?? null;

  return (
    <main className="bg-lgb-black min-h-screen flex items-center justify-center px-6 py-16">
      {resumen && session_id && (
        <PurchaseTracker
          sessionId={session_id}
          total={resumen.total}
          beats={resumen.order.map((o) => o.beatId)}
          licencias={resumen.order.map((o) => o.licenseId)}
        />
      )}
      <div className="text-center max-w-lg w-full">
        <Image
          src="/logos/lgb-hero.png"
          alt="Latino Gang Beats"
          width={220}
          height={63}
          className="h-12 w-auto mx-auto object-contain mb-10 opacity-80"
        />
        <CheckCircle2 size={56} className="text-green-400 mx-auto mb-6" />
        <h1 className="text-4xl font-coolvetica text-white mb-4">
          ¡Gracias por tu compra!
        </h1>

        {deliveries && deliveries.length > 0 ? (
          <>
            <p className="text-white/50 leading-relaxed mb-8">
              Tu pago se procesó correctamente. Aquí están tus beats:
            </p>
            <div className="flex flex-col gap-3 mb-10 text-left">
              {deliveries.map((d) => (
                <div
                  key={d.title}
                  className="rounded-2xl border border-white/10 bg-white/3 p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-white font-coolvetica truncate">{d.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {d.licenseName} · {d.files}
                    </p>
                  </div>
                  {d.driveUrl ? (
                    <a
                      href={d.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-lgb-red text-white text-sm px-5 py-2.5 rounded-full hover:bg-red-700 transition-all hover:scale-105 shrink-0"
                    >
                      <FolderDown size={15} />
                      Descargar
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-white/40 text-xs shrink-0">
                      <Clock size={14} />
                      Por email en &lt;24h
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-10">
              Guarda esta página: tu enlace de descarga seguirá funcionando.
              Tu contrato de licencia llega por email. ¿Algún problema?{" "}
              <a
                href={`mailto:${SOCIALS.email}`}
                className="text-lgb-red hover:text-red-400"
              >
                <Mail size={11} className="inline mr-1" />
                {SOCIALS.email}
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="text-white/50 leading-relaxed mb-3">
              Tu pago se procesó correctamente. En breve recibirás un correo con
              los archivos de tu beat y tu contrato de licencia.
            </p>
            <p className="text-white/30 text-sm leading-relaxed mb-10">
              Your payment was successful. You&apos;ll soon receive an email with
              your beat files and license agreement.
            </p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://aridomusicgroup.com/cuenta"
            className="inline-block bg-lgb-red text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-red-700 transition-all"
          >
            Ver mis compras
          </a>
          <a
            href="https://beats.aridomusicgroup.com"
            className="inline-block bg-white/5 border border-white/15 text-white/80 px-8 py-3 rounded-full text-sm font-medium hover:bg-white/10 transition-all"
          >
            ← Volver al catálogo
          </a>
        </div>
      </div>
    </main>
  );
}
