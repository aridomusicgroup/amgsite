import { Gift } from "lucide-react";
import { pesos, type Venta } from "@/lib/cursos-tipos";

/** “Cómo funciona la preventa” + bonos de fundador. Sin hooks (servidor o banco de pruebas). */
export function PreventaInfo({ venta, bonos }: { venta: Venta; bonos: string[] }) {
  const pasos = [
    {
      t: "Apartas tu lugar hoy",
      d: venta.precio && venta.precioRegular
        ? `Al precio de fundador: ${pesos(venta.precio)} en lugar de ${pesos(venta.precioRegular)} MXN.`
        : "Al precio de fundador, el más bajo que va a tener el curso.",
    },
    { t: "Terminamos de grabarlo", d: "Estamos grabando y editando cada lección para que salga completo y bien hecho." },
    {
      t: "Te avisamos al lanzar",
      d: `${venta.lanzamiento ? `Lanzamiento: ${venta.lanzamiento}. ` : ""}Ese día te llega un correo y entras a todo el curso con tu cuenta.`,
    },
    { t: "Tu precio ya no sube", d: "Pagas una vez. Cuando el curso suba al precio normal, tú ya estás dentro." },
  ];

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      <div className="rounded-2xl border border-lgb-red/25 bg-lgb-red/[0.05] p-5 sm:p-6">
        <h2 className="font-coolvetica text-3xl mb-5">Cómo funciona la preventa</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {pasos.map((p, i) => (
            <li key={p.t} className="flex gap-3">
              <span className="font-coolvetica text-2xl text-lgb-red w-6 shrink-0">{i + 1}</span>
              <span>
                <span className="block font-medium">{p.t}</span>
                <span className="block text-sm text-white/65 mt-0.5 leading-relaxed">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
        {bonos.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="font-medium mb-2">Bonos sólo para fundadores</p>
            <ul className="flex flex-col gap-2">
              {bonos.map((b) => (
                <li key={b} className="flex gap-2.5 text-sm text-white/80"><Gift size={16} className="text-lgb-red shrink-0 mt-0.5" /> {b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
