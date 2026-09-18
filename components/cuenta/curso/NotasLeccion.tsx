import { Download, FileText, Music2, Guitar, Paperclip } from "lucide-react";
import type { TipoRecurso } from "@/lib/cursos-tipos";

const ICONO: Record<TipoRecurso, typeof FileText> = { pdf: FileText, audio: Music2, gp: Guitar, otro: Paperclip };

/**
 * Lo que el maestro escribió en el guion de la lección (sólo lo ya escrito —
 * nada de [RELLENAR]) y los descargables. Server Component: es puro texto.
 */
export function NotasLeccion({ cursoId, leccionId, notas, recursos }: {
  cursoId: string;
  leccionId: string;
  notas: { label: string; texto: string }[];
  recursos: { titulo: string; tipo: TipoRecurso }[];
}) {
  if (!notas.length && !recursos.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {notas.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="font-coolvetica text-lg mb-3">Notas de la lección</h2>
          <dl className="flex flex-col gap-4">
            {notas.map((n) => (
              <div key={n.label}>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-lgb-red/90 mb-1">{n.label}</dt>
                <dd className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{n.texto}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {recursos.length > 0 && (
        <section>
          <h2 className="font-coolvetica text-lg mb-2">Descargables</h2>
          <div className="flex flex-col gap-2">
            {recursos.map((r, i) => {
              const Icono = ICONO[r.tipo] ?? Paperclip;
              return (
                <a key={`${i}-${r.titulo}`} href={`/api/cuenta/curso/${cursoId}/leccion/${leccionId}/recurso/${i}?descargar=1`}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-white/20 transition-colors">
                  <Icono size={16} className="text-white/50 shrink-0" />
                  <span className="flex-1 text-sm">{r.titulo}</span>
                  <Download size={14} className="text-white/40 shrink-0" />
                </a>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
