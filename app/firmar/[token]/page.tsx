import type { Metadata } from "next";
import { FileX, Clock, CheckCircle2 } from "lucide-react";
import { resolverInvitacion } from "@/lib/acuerdos/invitaciones";
import { getAcuerdoTexto } from "@/lib/acuerdos/server";
import { FAMILIA_LABEL } from "@/lib/acuerdos/familias";
import { FirmaPublica } from "@/components/cuenta/FirmaPublica";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Firmar acuerdo — Árido Music Group",
  robots: { index: false },
  icons: { icon: "/icon-lgb.png" },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/** Pantalla corta para cuando el enlace ya no sirve — sin exponer detalles. */
function Mensaje({ icon, titulo, texto }: { icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <main className="min-h-screen bg-lgb-black text-white flex items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-white/8 text-white/60 flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        <h1 className="font-coolvetica text-2xl mb-2">{titulo}</h1>
        <p className="text-white/50 text-sm leading-relaxed">{texto}</p>
      </div>
    </main>
  );
}

export default async function FirmarPage({ params }: Props) {
  const { token } = await params;
  const r = await resolverInvitacion(token);

  if (r.estado === "no_existe") {
    return (
      <Mensaje
        icon={<FileX size={20} />}
        titulo="Enlace no válido"
        texto="Este enlace no existe o está mal copiado. Pide uno nuevo por WhatsApp."
      />
    );
  }
  if (r.estado === "vencida") {
    return (
      <Mensaje
        icon={<Clock size={20} />}
        titulo="Este enlace ya venció"
        texto="Escríbenos por WhatsApp y te mandamos uno nuevo."
      />
    );
  }
  if (r.estado === "usada") {
    return (
      <Mensaje
        icon={<CheckCircle2 size={20} />}
        titulo="Ya quedó firmado"
        texto="Ese acuerdo ya se aceptó con este enlace. Si crees que es un error, escríbenos por WhatsApp."
      />
    );
  }

  const { inv } = r;
  const [{ titulo, cuerpo }, cot] = await Promise.all([
    getAcuerdoTexto(inv.familia),
    inv.cotizacion_id
      ? supabaseAdmin().from("cotizaciones").select("cliente_nombre").eq("id", inv.cotizacion_id).maybeSingle()
      : Promise.resolve(null),
  ]);
  const nombreSugerido = (cot && "data" in cot ? (cot.data?.cliente_nombre as string | null) : null) || "";

  return (
    <FirmaPublica
      token={token}
      titulo={titulo || FAMILIA_LABEL[inv.familia]}
      cuerpo={cuerpo}
      nombreSugerido={nombreSugerido}
    />
  );
}
