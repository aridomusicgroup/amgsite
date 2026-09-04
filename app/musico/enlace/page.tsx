import type { Metadata } from "next";
import Image from "next/image";
import { Mail } from "lucide-react";
import { SOCIALS } from "@/lib/site";
import { WhatsappIcon } from "@/components/shared/BrandIcons";

export const metadata: Metadata = {
  title: "Tu enlace — ARIDO",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Lo que se ve cuando el enlace no sirve.
 *
 * No hay pantalla de login porque no hay contraseña: la única forma de entrar es
 * un enlace nuevo, y el único que lo puede mandar es el estudio. Así que esta
 * página no pide nada — dice qué pasó y a dónde escribir.
 */
const MOTIVOS: Record<string, string> = {
  vencido: "Ese enlace ya venció. Duran 30 minutos por seguridad.",
  sinacceso: "Ese enlace ya no tiene acceso al portal.",
  limite: "Demasiados intentos seguidos. Espera unos minutos y vuelve a abrir tu enlace.",
};

export default async function EnlaceMusicoPage({ searchParams }: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  const motivo = MOTIVOS[e ?? ""] ?? "Ese enlace no es válido.";

  return (
    <main className="min-h-screen bg-lgb-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <Image src="/logos/arido-blanco.png" alt="ARIDO" width={140} height={46}
          className="h-10 w-auto object-contain mx-auto mb-8" />

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <Mail size={22} className="text-lgb-red mx-auto mb-3" />
          <p className="text-sm text-white/70 leading-relaxed">{motivo}</p>
          <p className="text-xs text-white/35 mt-3 leading-relaxed">
            Pídele al estudio que te mande uno nuevo y entras al instante — no hay contraseña que recordar.
          </p>
        </div>

        <a
          href={SOCIALS.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <WhatsappIcon className="w-4 h-4" /> Escribirle al estudio
        </a>
      </div>
    </main>
  );
}
