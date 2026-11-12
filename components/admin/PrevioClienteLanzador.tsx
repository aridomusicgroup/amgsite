"use client";
import { useEffect, useRef, useState } from "react";
import { Music4, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { EVENTO_PREVIO_CLIENTE, type PreguntaPrevio } from "@/lib/previo-cliente-tipos";
import { useEncolarRender } from "@/components/admin/RenderControles";
import type { MusicoLite, Renderizable } from "@/lib/render-jobs";

/**
 * "Ya mezclaste: ¿le mandas un previo al cliente?"
 *
 * Sale al palomear Mezclar o Masterizar de un proyecto de cliente. Montado una
 * vez en el menú, como el cuadro de entrega y el del pago al músico: la palomita
 * lanza el evento `arido:previo-cliente` (vía atenderRespuesta) y esto lo
 * escucha desde cualquier página.
 *
 * "Sí" no manda nada por sí solo: abre el MISMO cuadro de opciones del botón
 * "Previo" (qué .rpp, qué tramo, qué canales silenciar) con "mandárselo al
 * cliente" ya marcado, y de ahí sale el render. Así el previo se revisa antes de
 * encolarlo, y la decisión de mandarlo sigue siendo un acto y no un descuido.
 * "Ahora no" no toca nada: el previo se puede mandar cuando sea desde REAPER.
 */
export function PrevioClienteLanzador() {
  const [pregunta, setPregunta] = useState<PreguntaPrevio | null>(null);
  const [musicos, setMusicos] = useState<MusicoLite[]>([]);
  const { abrir, cuadro } = useEncolarRender();

  useEffect(() => {
    const alPedir = (e: Event) => setPregunta((e as CustomEvent<PreguntaPrevio>).detail);
    window.addEventListener(EVENTO_PREVIO_CLIENTE, alPedir);
    return () => window.removeEventListener(EVENTO_PREVIO_CLIENTE, alPedir);
  }, []);

  // `cuadro` pinta el cuadro de opciones cuando `abrir` lo pidió; si no, nada.
  return (
    <>
      {pregunta && (
        <Pregunta
          key={`${pregunta.proyectoId}:${pregunta.temaId ?? ""}:${pregunta.paso}`}
          q={pregunta}
          onCerrar={() => setPregunta(null)}
          onAbrir={(p, m) => { setMusicos(m); setPregunta(null); abrir(p, "previo", true); }}
        />
      )}
      {cuadro(musicos)}
    </>
  );
}

function Pregunta({ q, onCerrar, onAbrir }: {
  q: PreguntaPrevio;
  onCerrar: () => void;
  onAbrir: (p: Renderizable, musicos: MusicoLite[]) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const si = useRef<HTMLButtonElement>(null);
  const nombre = q.cliente?.trim().split(/\s+/)[0] || "el cliente";

  useEffect(() => {
    si.current?.focus();
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape" && !cargando) onCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [cargando, onCerrar]);

  const preparar = async () => {
    setCargando(true);
    try {
      const qs = new URLSearchParams({ proyecto_id: q.proyectoId, tema_id: q.temaId ?? "" });
      const r = await fetch(`/api/admin/render/previo-datos?${qs}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo preparar el previo");
      onAbrir(d.p as Renderizable, (d.musicos ?? []) as MusicoLite[]);
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo preparar el previo"}`);
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !cargando && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="previo-cliente-t"
        className="w-full max-w-md rounded-2xl bg-lgb-dark border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <span className="w-9 h-9 rounded-xl bg-lgb-red/15 text-lgb-red flex items-center justify-center shrink-0"><Music4 size={17} aria-hidden /></span>
          <div className="min-w-0">
            <p id="previo-cliente-t" className="font-coolvetica text-lg leading-tight">¿Le mandas un previo a {nombre}?</p>
            <p className="text-white/45 text-xs mt-0.5">Marcaste {q.paso} en {q.donde}</p>
          </div>
        </div>

        <p className="text-sm text-white/55 leading-relaxed mb-4">
          Se renderiza en REAPER y le llega por correo. En su panel lo escucha y puede comentarlo:
          cada comentario te llega como una tarea.
        </p>

        <div className="flex gap-2">
          <button
            ref={si}
            onClick={preparar}
            disabled={cargando}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-lgb-red text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {cargando && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Sí, preparar el previo
          </button>
          <button
            onClick={onCerrar}
            disabled={cargando}
            className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
