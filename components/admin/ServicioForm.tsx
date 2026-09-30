"use client";
import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Catalogo, Extra, Paquete, ServicioEstudio } from "@/lib/servicios";
import type { TipoServicio } from "@/lib/servicios-validar";

export type ItemServicio = Paquete | Extra | ServicioEstudio;

interface EleccionForm { id?: string; tituloEs: string; tituloEn: string; alternativas: string }

interface Estado {
  nombreEs: string; nombreEn: string; precio: string; activo: boolean;
  // paquete
  taglineEs: string; taglineEn: string; incluyeEs: string; incluyeEn: string;
  incluidos: string[]; elecciones: EleccionForm[];
  // instrumento
  graba: boolean;
  // estudio
  descEs: string; descEn: string;
}

const lineas = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function inicial(tipo: TipoServicio, it: ItemServicio | null): Estado {
  const base: Estado = {
    nombreEs: "", nombreEn: "", precio: "", activo: true,
    taglineEs: "", taglineEn: "", incluyeEs: "", incluyeEn: "", incluidos: [], elecciones: [],
    graba: true, descEs: "", descEn: "",
  };
  if (!it) return base;
  const out: Estado = { ...base, precio: String(it.price), activo: it.activo };
  if (tipo === "base") {
    const p = it as Paquete;
    return {
      ...out, nombreEs: p.name.es, nombreEn: p.name.en, taglineEs: p.tagline.es, taglineEn: p.tagline.en,
      incluyeEs: p.includes.es.join("\n"), incluyeEn: p.includes.en.join("\n"), incluidos: p.includedExtras,
      elecciones: p.choices.map((c) => ({
        id: c.id, tituloEs: c.label.es, tituloEn: c.label.en,
        alternativas: c.options.map((o) => (o.label.en !== o.label.es ? `${o.label.es} | ${o.label.en}` : o.label.es)).join("\n"),
      })),
    };
  }
  if (tipo === "extra") {
    const e = it as Extra;
    return { ...out, nombreEs: e.label.es, nombreEn: e.label.en, graba: e.graba };
  }
  const s = it as ServicioEstudio;
  return { ...out, nombreEs: s.label.es, nombreEn: s.label.en, descEs: s.description.es, descEn: s.description.en };
}

/** Lo que espera la API, según el tipo. La validación de verdad vive en el servidor. */
function payload(tipo: TipoServicio, f: Estado, id?: string) {
  const nombre = { es: f.nombreEs, en: f.nombreEn };
  const common = { tipo, id, price: Number(f.precio), activo: f.activo };
  if (tipo === "extra") return { ...common, label: nombre, graba: f.graba };
  if (tipo === "studio") return { ...common, label: nombre, description: { es: f.descEs, en: f.descEn } };
  return {
    ...common, name: nombre,
    tagline: { es: f.taglineEs, en: f.taglineEn },
    includes: { es: lineas(f.incluyeEs), en: lineas(f.incluyeEn) },
    includedExtras: f.incluidos,
    choices: f.elecciones.map((c) => ({
      id: c.id,
      label: { es: c.tituloEs, en: c.tituloEn },
      options: lineas(c.alternativas).map((l) => {
        const [es, en] = l.split("|").map((x) => x.trim());
        return { label: { es, en: en || es } };
      }),
    })),
  };
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mt-3">
      <span className="text-white/60 text-xs">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-white/35 text-[11px] mt-1">{hint}</span>}
    </label>
  );
}

/** Español e inglés lado a lado. El inglés, si se deja vacío, copia el español. */
function Bilingue({ label, es, en, onEs, onEn, area }: { label: string; es: string; en: string; onEs: (v: string) => void; onEn: (v: string) => void; area?: boolean }) {
  const cls = "input";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
      <Campo label={`${label} (español)`}>
        {area ? <textarea rows={5} value={es} onChange={(e) => onEs(e.target.value)} className={cls} /> : <input value={es} onChange={(e) => onEs(e.target.value)} className={cls} />}
      </Campo>
      <Campo label={`${label} (inglés)`}>
        {area ? <textarea rows={5} value={en} onChange={(e) => onEn(e.target.value)} className={cls} /> : <input value={en} onChange={(e) => onEn(e.target.value)} className={cls} placeholder="Opcional" />}
      </Campo>
    </div>
  );
}

const TITULO: Record<TipoServicio, [string, string]> = {
  base: ["Nuevo paquete", "Editar paquete"],
  extra: ["Nuevo instrumento", "Editar instrumento"],
  studio: ["Nuevo servicio de estudio", "Editar servicio de estudio"],
};

export function ServicioForm({ tipo, inicial: item, catalogo, onClose, onSaved }: {
  tipo: TipoServicio; inicial: ItemServicio | null; catalogo: Catalogo; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Estado>(() => inicial(tipo, item));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Estado>) => setF((p) => ({ ...p, ...patch }));

  const guardar = async () => {
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/servicios", {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(tipo, f, item?.id)),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "No se pudo guardar."); return; }
      toast("✓ Guardado — ya se ve en el cotizador");
      onSaved();
    } catch {
      setErr("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const editarEleccion = (i: number, patch: Partial<EleccionForm>) =>
    set({ elecciones: f.elecciones.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-lgb-dark border border-white/10 rounded-2xl p-5 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-coolvetica text-xl">{TITULO[tipo][item ? 1 : 0]}</h2>
          <button aria-label="Cerrar" onClick={onClose} className="text-white/40 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>

        <Bilingue label="Nombre" es={f.nombreEs} en={f.nombreEn} onEs={(v) => set({ nombreEs: v })} onEn={(v) => set({ nombreEn: v })} />

        <Campo label="Precio (MXN)">
          <input inputMode="numeric" value={f.precio} onChange={(e) => set({ precio: e.target.value.replace(/[^\d]/g, "") })} className="input max-w-[180px]" />
        </Campo>

        {tipo === "extra" && (
          <>
            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={f.graba} onChange={(e) => set({ graba: e.target.checked })} className="mt-0.5" />
              <span className="text-sm">
                Se graba con un músico
                <span className="block text-white/40 text-xs">
                  Al venderlo se crea la tarea “Grabar {f.nombreEs.trim() || "…"}” y se le asigna su músico titular.
                </span>
              </span>
            </label>
            {!item && (
              <p className="text-white/40 text-[11px] mt-3">
                Escríbelo igual que aparece en el catálogo de músicos (por ejemplo “Violín”) para que se le asigne
                solo. Después de guardarlo verás un aviso “Sin músico” si nadie lo toca todavía. El nombre queda fijo:
                las ventas y plantillas se ligan a él.
              </p>
            )}
          </>
        )}

        {tipo === "studio" && (
          <Bilingue label="Descripción" es={f.descEs} en={f.descEn} onEs={(v) => set({ descEs: v })} onEn={(v) => set({ descEn: v })} />
        )}

        {tipo === "base" && (
          <>
            <Bilingue label="Frase corta" es={f.taglineEs} en={f.taglineEn} onEs={(v) => set({ taglineEs: v })} onEn={(v) => set({ taglineEn: v })} />
            <Bilingue label="Qué incluye (uno por línea)" area es={f.incluyeEs} en={f.incluyeEn} onEs={(v) => set({ incluyeEs: v })} onEn={(v) => set({ incluyeEn: v })} />
            <p className="text-white/35 text-[11px] mt-1">
              De aquí salen las tareas: cada renglón que no sea mezcla o master se toma como instrumento a grabar.
              Mantén el mismo orden en inglés.
            </p>

            <Campo label="Instrumentos que ya trae (no se cobran aparte)">
              <div className="flex gap-1.5 flex-wrap">
                {catalogo.extras.map((e) => {
                  const on = f.incluidos.includes(e.id);
                  return (
                    <button
                      type="button" key={e.id}
                      onClick={() => set({ incluidos: on ? f.incluidos.filter((x) => x !== e.id) : [...f.incluidos, e.id] })}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${on ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}
                    >
                      {e.label.es}
                    </button>
                  );
                })}
              </div>
            </Campo>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-xs">Opciones que elige el cliente (ej. guitarra o bajoquinto)</span>
                {f.elecciones.length < 3 && (
                  <button type="button" onClick={() => set({ elecciones: [...f.elecciones, { tituloEs: "", tituloEn: "", alternativas: "" }] })} className="flex items-center gap-1 text-xs text-white/60 hover:text-white cursor-pointer">
                    <Plus size={13} /> Agregar opción
                  </button>
                )}
              </div>
              {f.elecciones.map((c, i) => (
                <div key={i} className="mt-2 rounded-xl border border-white/8 p-3">
                  <div className="flex justify-end">
                    <button type="button" aria-label="Quitar opción" onClick={() => set({ elecciones: f.elecciones.filter((_, j) => j !== i) })} className="text-white/30 hover:text-white cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                  <Bilingue label="Pregunta" es={c.tituloEs} en={c.tituloEn} onEs={(v) => editarEleccion(i, { tituloEs: v })} onEn={(v) => editarEleccion(i, { tituloEn: v })} />
                  <Campo label="Alternativas (una por línea; “Español | English”, mínimo 2)">
                    <textarea rows={3} value={c.alternativas} onChange={(e) => editarEleccion(i, { alternativas: e.target.value })} className="input" />
                  </Campo>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 p-4">
              <p className="text-white/40 text-[11px] mb-1">Así se ve en el cotizador</p>
              <p className="font-coolvetica text-lg">{f.nombreEs || "Nombre del paquete"}</p>
              <p className="text-white/50 text-xs mb-2">{f.taglineEs}</p>
              <ul className="text-xs text-white/60 flex flex-col gap-0.5 mb-2">
                {lineas(f.incluyeEs).map((x) => <li key={x}>✓ {x}</li>)}
              </ul>
              <p className="font-coolvetica text-xl">{f.precio ? `$${Number(f.precio).toLocaleString("es-MX")}` : "$—"} <span className="text-xs text-white/40 font-sans">MXN</span></p>
            </div>
          </>
        )}

        <label className="flex items-center gap-2 mt-4 cursor-pointer text-sm">
          <input type="checkbox" checked={f.activo} onChange={(e) => set({ activo: e.target.checked })} />
          Visible en el cotizador
        </label>

        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={guardar} disabled={saving} className="flex-1 bg-lgb-red text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white bg-white/5 cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
