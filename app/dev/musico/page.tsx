import { notFound } from "next/navigation";
import { SubirParte } from "@/components/musico/SubirParte";
import { previoMusicoEmail } from "@/lib/emails";
import type { ArchivoMusico } from "@/lib/musico-data";

/**
 * Banco de pruebas del portal del músico (/musico pide su enlace) y del correo
 * del previo: el trombón con pistas extra, las charchetas con L/R, y el correo
 * con compás e indicación de formato. En producción no existe.
 */
const archivo = (id: string, slot: number, nombre: string, importado = false): ArchivoMusico => ({
  id, clase: "stem", slot, nombre, subido_at: "2026-09-29T22:51:11Z",
  aprobado_at: null, bajado_at: importado ? "2026-09-29T22:54:01Z" : null, importado_at: importado ? "2026-09-29T22:54:03Z" : null,
});

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const correo = previoMusicoEmail({
    musico: "Diego", proyecto: "EFÍMERO", bpm: 123, tonalidad: "Em", compas: "6/8",
    instrumentos: ["Trombón"], nota: "Entras en el segundo coro.", url: "#",
  });
  return (
    <main className="min-h-screen bg-lgb-black text-white p-4 sm:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <p className="font-coolvetica text-lg">EFÍMERO</p>
          <p className="text-lgb-red text-sm mb-3">Trombón · sin canales fijos, ya mandó 2</p>
          <dl className="grid grid-cols-3 rounded-xl border border-white/8 bg-white/[0.02] mb-3 divide-x divide-white/8 text-center">
            {[["Tempo", "123 bpm"], ["Tonalidad", "Em"], ["Compás", "6/8"]].map(([k, v]) => (
              <div key={k} className="px-2 py-2.5"><dt className="text-[11px] uppercase tracking-wider text-white/35">{k}</dt><dd className="text-sm mt-0.5">{v}</dd></div>
            ))}
          </dl>
          <SubirParte asignacionId="a1" canales={[]} destino="EFÍMERO · TRiP MX" duracionRef={186} temaRef="EFÍMERO"
            archivos={[archivo("f1", 0, "efimero wav 1.wav", true), archivo("f2", 1, "efimero wav 2.wav")]} />
        </section>
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <p className="font-coolvetica text-lg">SANGRELOCO</p>
          <p className="text-lgb-red text-sm mb-3">Charchetas · canales L, R</p>
          <SubirParte asignacionId="a2" canales={["L", "R"]} destino="SANGRELOCO" duracionRef={null} temaRef="SANGRELOCO" archivos={[]} />
        </section>
        <p className="text-xs text-white/40">Correo del previo: {correo.subject}</p>
        <iframe title="Correo del previo" srcDoc={correo.html} className="w-full h-[1100px] rounded-xl bg-white" />
      </div>
    </main>
  );
}
