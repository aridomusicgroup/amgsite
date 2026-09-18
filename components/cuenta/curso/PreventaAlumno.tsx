import Link from "next/link";
import { CalendarClock, Gift, ListChecks } from "lucide-react";

/**
 * Lo que ve quien compró en preventa: su lugar apartado, cuándo abre y sus
 * bonos. Las lecciones no aparecen hasta el lanzamiento (decisión del curso).
 */
export function PreventaAlumno({ slug, lanzamiento, bonos }: { slug: string; lanzamiento: string; bonos: string[] }) {
  return (
    <section className="rounded-2xl border border-lgb-red/30 bg-lgb-red/[0.06] p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-lgb-red mb-2">Preventa · fundador</p>
      <h2 className="font-coolvetica text-2xl mb-2">Tu lugar está apartado 🎸</h2>
      <p className="text-sm text-white/75 leading-relaxed">
        El día del lanzamiento te llega un correo y aquí mismo aparecen todas las lecciones. No tienes que hacer nada más.
      </p>
      {lanzamiento && (
        <p className="flex items-center gap-2 text-sm mt-3">
          <CalendarClock size={16} className="text-lgb-red shrink-0" /> Lanzamiento: <span className="font-medium">{lanzamiento}</span>
        </p>
      )}
      {bonos.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] text-white/55 mb-1.5">Tus bonos de fundador</p>
          <ul className="flex flex-col gap-1.5">
            {bonos.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-white/80"><Gift size={15} className="text-lgb-red shrink-0 mt-0.5" /> {b}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/cursos/${slug}#temario`} className="mt-5 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-white/10 hover:bg-white/15">
        <ListChecks size={13} /> Ver el temario completo
      </Link>
    </section>
  );
}
