"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { TONALIDADES, MAX_DESCRIPCION, MAX_NOTAS } from "@/lib/beat-ficha";
import type { BeatDetalleAdmin } from "@/lib/beat-admin";
import { guardarFicha, inp, lblS, Seccion } from "./comun";

const GENEROS = ["Corrido Tumbado", "Corrido", "Latin", "Trap Latino", "Reggaeton", "Banda", "Norteño", "Mexican Pop", "Latin Pop", "Drill"];
const MOODS = ["Energetic", "Dark", "Sad", "Romantic", "Chill", "Aggressive", "Epic"];

type Campos = {
  bpm: string; tonalidad: string; genero: string; mood: string;
  artistas: string; tags: string; descripcion: string; notas: string;
};

const desdeFicha = (d: BeatDetalleAdmin): Campos => ({
  bpm: d.ficha.bpm ? String(d.ficha.bpm) : "",
  tonalidad: d.ficha.tonalidad ?? "",
  genero: d.ficha.genero ?? "",
  mood: d.ficha.mood ?? "",
  artistas: (d.ficha.artistas ?? []).join(", "),
  tags: (d.ficha.tags ?? []).join(", "),
  descripcion: d.ficha.descripcion ?? "",
  notas: d.ficha.notas ?? "",
});

/** Lo que va al servidor: sólo los campos que cambiaron; vacío = volver a lo de siempre. */
function diferencias(antes: Campos, ahora: Campos): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(ahora) as (keyof Campos)[]) {
    if (antes[k].trim() === ahora[k].trim()) continue;
    const v = ahora[k].trim();
    if (k === "artistas" || k === "tags") out[k] = v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;
    else if (k === "bpm") out[k] = v ? Number(v) : null;
    else out[k] = v || null;
  }
  return out;
}

/**
 * Ficha: los datos del beat que salen en la tienda y en el chatbot.
 * Cada campo muestra en gris lo que trae el beat de su fuente; si lo dejas
 * vacío, se queda eso. Sirve igual para originales y agregados.
 */
export function FichaTab({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const inicial = useMemo(() => desdeFicha(d), [d]);
  const [f, setF] = useState<Campos>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambios = diferencias(inicial, f);
  const hayCambios = Object.keys(cambios).length > 0;
  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const guardar = async () => {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    setError(null);
    const err = await guardarFicha(d.id, cambios);
    setGuardando(false);
    if (err) { setError(err); return; }
    toast("✓ Ficha guardada — ya se ve así en la tienda");
    router.refresh();
  };

  const base = d.base;
  const deshabilitado = !d.tablaFicha;

  return (
    <div className="space-y-4">
      <Seccion
        titulo="Datos musicales"
        nota={<>En gris va lo que trae el beat de {d.source === "original" ? "el catálogo original" : "BeatStars"}. Deja el campo vacío para usar eso.</>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={lblS} htmlFor="f-bpm">BPM</label>
            <input id="f-bpm" value={f.bpm} onChange={set("bpm")} inputMode="numeric" disabled={deshabilitado}
              placeholder={base.bpm ? String(base.bpm) : "130"} className={`${inp} ${!f.bpm && !base.bpm ? "border-amber-400/40" : ""}`} />
          </div>
          <div>
            <label className={lblS} htmlFor="f-ton">Tonalidad</label>
            <select id="f-ton" value={f.tonalidad} onChange={set("tonalidad")} disabled={deshabilitado}
              className={`${inp} ${!f.tonalidad && !base.key ? "border-amber-400/40" : ""}`}>
              <option value="">{base.key ? `${base.key} (de la fuente)` : "— sin tonalidad —"}</option>
              {f.tonalidad && !(TONALIDADES as readonly string[]).includes(f.tonalidad) && <option value={f.tonalidad}>{f.tonalidad}</option>}
              {TONALIDADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lblS} htmlFor="f-gen">Género</label>
            <input id="f-gen" value={f.genero} onChange={set("genero")} list="beat-generos" disabled={deshabilitado}
              placeholder={base.genre} className={inp} />
            <datalist id="beat-generos">{GENEROS.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label className={lblS} htmlFor="f-mood">Mood</label>
            <input id="f-mood" value={f.mood} onChange={set("mood")} list="beat-moods" disabled={deshabilitado}
              placeholder={base.mood} className={inp} />
            <datalist id="beat-moods">{MOODS.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Artistas y etiquetas"
        nota="Los artistas son el filtro de la tienda (Junior H, Peso Pluma…) y lo que usa el chatbot para recomendar. Sepáralos con comas."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={lblS} htmlFor="f-art">Artistas (type beat de…)</label>
            <input id="f-art" value={f.artistas} onChange={set("artistas")} disabled={deshabilitado}
              placeholder={base.artists.join(", ") || "Junior H, Natanael Cano"} className={inp} />
          </div>
          <div>
            <label className={lblS} htmlFor="f-tags">Etiquetas para la búsqueda</label>
            <input id="f-tags" value={f.tags} onChange={set("tags")} disabled={deshabilitado}
              placeholder={base.tags.join(", ") || "corrido, tumbado, sad"} className={inp} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Descripción" nota="Sale en la página pública del beat y en la vista previa al compartir el link.">
        <textarea value={f.descripcion} onChange={set("descripcion")} rows={3} maxLength={MAX_DESCRIPCION} disabled={deshabilitado}
          placeholder="Ej. Corrido tumbado oscuro con requinto al frente, ideal para letras de desamor."
          className={`${inp} resize-y`} />
        <p className="text-right text-[11px] text-white/35 mt-1">{f.descripcion.length}/{MAX_DESCRIPCION}</p>
      </Seccion>

      <Seccion titulo="Notas internas" nota="Sólo las ve el equipo en este panel (p. ej. a quién se le ofreció, pendientes).">
        <textarea value={f.notas} onChange={set("notas")} rows={3} maxLength={MAX_NOTAS} disabled={deshabilitado}
          className={`${inp} resize-y`} />
      </Seccion>

      <div className="flex items-center gap-3 flex-wrap sticky bottom-3 z-10">
        <button onClick={guardar} disabled={!hayCambios || guardando || deshabilitado}
          className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer shadow-lg shadow-black/30">
          {guardando && <Loader2 size={15} className="animate-spin" />}
          {guardando ? "Guardando…" : hayCambios ? "Guardar cambios" : "Sin cambios"}
        </button>
        {hayCambios && !guardando && (
          <button onClick={() => { setF(inicial); setError(null); }}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm cursor-pointer">
            <RotateCcw size={13} /> Deshacer
          </button>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </div>
  );
}
