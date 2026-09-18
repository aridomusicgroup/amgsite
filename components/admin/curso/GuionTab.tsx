"use client";
import { camposDeEtiqueta, esRellenar, indicacion, type Cta, type Etiqueta } from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";

export { indicacion };

/**
 * Estado de edición del guion: lo que sigue siendo plantilla arranca VACÍO,
 * con la indicación de la plantilla como placeholder — así se escribe encima
 * sin tener que borrar el [RELLENAR]. Si se deja vacío, la indicación se queda.
 */
export function textosIniciales(contenido: Record<string, unknown>, claves: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of claves) out[k] = esRellenar(contenido[k]) ? "" : String(contenido[k]);
  return out;
}

export function textosAContenido(textos: Record<string, string>, original: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(textos)) {
    if (v.trim()) out[k] = v;
    // Vacío: si era plantilla se conserva la indicación; si era texto tuyo, se borra.
    else out[k] = typeof original[k] === "string" && esRellenar(original[k]) ? original[k] : "";
  }
  return out;
}

export const clavesGuion = (etiqueta: Etiqueta, cta: Cta): string[] => [
  ...camposDeEtiqueta(etiqueta).map((c) => c.key),
  ...(cta !== "ninguno" ? ["cta_texto"] : []),
  "notas_grabacion",
];

export function GuionTab({ etiqueta, cta, original, textos, onChange }: {
  etiqueta: Etiqueta;
  cta: Cta;
  original: Record<string, unknown>;
  textos: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  const campos = [
    ...camposDeEtiqueta(etiqueta),
    ...(cta !== "ninguno" ? [{ key: "cta_texto", label: "Texto del llamado", ayuda: "Si lo dejas vacío se usa el texto general del curso." }] : []),
    { key: "notas_grabacion", label: "Notas para grabar (sólo tú las ves)", ayuda: "Ángulo de cámara, afinación, capo, pista a usar…" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-white/40 text-[11px]">
        Escribe con tus palabras. Lo que dejes vacío conserva la indicación de la plantilla y el alumno no lo ve.
      </p>
      {campos.map((c) => {
        const pista = indicacion(original[c.key]) || c.ayuda;
        return (
          <label key={c.key} className="block">
            <span className={lblS}>{c.label}</span>
            <textarea
              value={textos[c.key] ?? ""}
              onChange={(e) => onChange(c.key, e.target.value)}
              placeholder={pista}
              rows={c.key === "practica" || c.key === "explicacion" || c.key === "historia_personal" || c.key === "instrucciones" ? 4 : 2}
              className={`${inp} resize-y`}
            />
          </label>
        );
      })}
    </div>
  );
}
