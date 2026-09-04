import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Music2, CalendarClock, ExternalLink, LogOut, Check } from "lucide-react";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionesDeMusico, type AsignacionMusico } from "@/lib/musico-data";
import { SubirParte } from "@/components/musico/SubirParte";

export const metadata: Metadata = {
  title: "Mis grabaciones — ARIDO",
  robots: { index: false },
  icons: { icon: "/icon-lgb.png" },
};

export const dynamic = "force-dynamic";

const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long" });

export default async function MusicoPage() {
  const id = await getMusicoId();
  if (!id) redirect("/musico/enlace");

  // Se revalida el portal en cada carga: si le apagaron el acceso, su cookie
  // de 30 días deja de servir aquí mismo.
  const musico = await getMusico(id);
  if (!musico) redirect("/musico/enlace?e=sinacceso");

  const asignaciones = await asignacionesDeMusico(id);
  const pendientes = asignaciones.filter((a) => a.estado !== "aceptado");

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Image src="/logos/arido-blanco.png" alt="ARIDO" width={120} height={40}
              className="h-8 w-auto object-contain mb-3" />
            <h1 className="font-coolvetica text-2xl">Hola, {musico.nombre.split(" ")[0]}</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {pendientes.length === 0
                ? "No tienes grabaciones pendientes."
                : pendientes.length === 1
                  ? "Tienes 1 grabación pendiente."
                  : `Tienes ${pendientes.length} grabaciones pendientes.`}
            </p>
          </div>
          <a href="/api/musico/logout"
            className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs transition-colors shrink-0 mt-1">
            <LogOut size={13} /> Salir
          </a>
        </header>

        {asignaciones.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <Music2 size={22} className="text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/50">Todavía no hay nada asignado para ti.</p>
            <p className="text-xs text-white/30 mt-1.5">
              Cuando el estudio te asigne una canción, aparece aquí y te llega un correo.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {asignaciones.map((a) => <Tarjeta key={a.id} a={a} />)}
          </div>
        )}

        <p className="text-white/20 text-[11px] text-center mt-10 leading-relaxed">
          Este portal es solo tuyo. Lo que subas aquí llega directo al estudio.
        </p>
      </div>
    </main>
  );
}

function Tarjeta({ a }: { a: AsignacionMusico }) {
  const vencida = a.fechaLimite && !a.hecha && a.fechaLimite < new Date().toISOString().slice(0, 10);
  const entregados = a.archivos.filter((x) => x.clase === "stem").length;

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-coolvetica text-lg truncate">{a.cancion}</p>
          <p className="text-lgb-red text-sm mt-0.5">{a.instrumento}</p>
        </div>
        {entregados > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-green-300 bg-green-500/10 border border-green-500/25 rounded-full px-2.5 py-1 shrink-0">
            <Check size={11} /> Entregado
          </span>
        )}
      </div>

      {a.fechaLimite && (
        <p className={`flex items-center gap-1.5 text-xs mb-3 ${vencida ? "text-red-300" : "text-white/45"}`}>
          <CalendarClock size={13} />
          {vencida ? "Se pasó la fecha: " : "Para el "}{fecha(a.fechaLimite)}
        </p>
      )}

      {a.nota && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Indicaciones</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap break-words">{a.nota}</p>
        </div>
      )}

      {a.referencia && (
        <a href={a.referencia} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:underline mb-4">
          <Music2 size={14} /> Escuchar la pista de referencia <ExternalLink size={12} />
        </a>
      )}

      <SubirParte asignacionId={a.id} archivos={a.archivos} />
    </section>
  );
}
