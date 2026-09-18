"use client";
import { useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import type { CursoDetalle } from "@/lib/cursos-admin";
import { descuentoPct, pesos, textoCierre, type ConfigPreventa } from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";
import { toast } from "@/lib/toast";

/** Lo que se captura de la preventa (en texto, como los inputs). `activa` lo decide el selector de estado. */
export interface PreventaForm { precio: string; cierre: string; cupo: string; lanzamiento: string; bonos: string }

export const preventaAForm = (p: ConfigPreventa): PreventaForm => ({
  precio: p.precio?.toString() ?? "",
  cierre: p.cierre ?? "",
  cupo: p.cupo?.toString() ?? "",
  lanzamiento: p.lanzamiento,
  bonos: p.bonos,
});

export const formAPreventa = (f: PreventaForm, actual: ConfigPreventa): ConfigPreventa => ({
  activa: actual.activa,
  precio: Number(f.precio) > 0 ? Number(f.precio) : null,
  cierre: f.cierre || null,
  cupo: Number(f.cupo) > 0 ? Math.floor(Number(f.cupo)) : null,
  lanzamiento: f.lanzamiento.trim(),
  bonos: f.bonos,
});

/** Resumen del estado de la preventa tal como la ve el público (lo calcula el servidor). */
function lineaEstado(c: CursoDetalle): string {
  const v = c.venta;
  if (!c.config.preventa.activa) return "El curso ya se lanzó: se vende al precio normal.";
  if (v.estado === "oculto") return "Oculto: nadie ve la página todavía. Elige “Preventa” arriba para abrirla.";
  if (v.estado === "preventa_cerrada") {
    return v.motivoCierre === "cupo" ? "Cerrada: se llenó el cupo. Ya no vende hasta el lanzamiento."
      : v.motivoCierre === "fecha" ? "Cerrada: pasó la fecha de cierre. Ya no vende hasta el lanzamiento."
      : "Sin precio de preventa: no vende.";
  }
  const partes = [`Abierta · ${pesos(v.precio ?? 0)}`];
  if (v.quedan != null) partes.push(`quedan ${v.quedan}`);
  if (v.diasParaCierre != null) partes.push(textoCierre(v.diasParaCierre).toLowerCase());
  return partes.join(" · ");
}

/**
 * Datos de la preventa del curso: precio fundador, cierre, cupo, lanzamiento
 * y bonos, más quién ya compró y quién pidió que le avisaran. Se guarda con el
 * botón “Guardar” de la cabecera.
 */
export function PreventaCard({ curso, valor, onChange, precioRegular }: {
  curso: CursoDetalle;
  valor: PreventaForm;
  onChange: (v: PreventaForm) => void;
  precioRegular: number | null;
}) {
  const [abierta, setAbierta] = useState(curso.config.preventa.activa || !curso.activo);
  const desc = descuentoPct(Number(valor.precio) || null, precioRegular);
  const set = (k: keyof PreventaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...valor, [k]: e.target.value });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(curso.avisame.join(", "));
      toast(`Copiados ${curso.avisame.length} correos`);
    } catch {
      toast("No se pudieron copiar");
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <button onClick={() => setAbierta((v) => !v)} className="flex items-center gap-1 text-sm font-medium cursor-pointer">
        <ChevronDown size={14} className={abierta ? "rotate-180" : ""} /> Preventa
      </button>
      <p className="text-white/40 text-xs mt-1">{lineaEstado(curso)}</p>
      <p className="text-white/60 text-xs mt-2">
        {curso.fundadores} fundador{curso.fundadores === 1 ? "" : "es"} · {curso.avisame.length} en la lista Avísame
        {curso.avisame.length > 0 && (
          <button onClick={copiar} className="ml-2 inline-flex items-center gap-1 text-white/50 hover:text-white cursor-pointer">
            <Copy size={12} /> Copiar correos
          </button>
        )}
      </p>

      {abierta && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lblS}>Precio de fundador (MXN){desc ? ` · ${desc}% menos` : ""}</span>
            <input value={valor.precio} onChange={set("precio")} type="number" min="0" className={inp}
              placeholder={precioRegular ? `Menos de ${pesos(precioRegular)}` : "Ej. 999"} />
          </label>
          <label className="block">
            <span className={lblS}>Lanzamiento estimado</span>
            <input value={valor.lanzamiento} onChange={set("lanzamiento")} maxLength={80} className={inp} placeholder="Ej. noviembre 2026" />
          </label>
          <label className="block">
            <span className={lblS}>Cierra el (opcional)</span>
            <input value={valor.cierre} onChange={set("cierre")} type="date" className={inp} />
          </label>
          <label className="block">
            <span className={lblS}>Lugares de fundador (opcional)</span>
            <input value={valor.cupo} onChange={set("cupo")} type="number" min="1" className={inp} placeholder="Sin límite" />
          </label>
          <label className="block sm:col-span-2">
            <span className={lblS}>Bonos de fundador (uno por renglón)</span>
            <textarea value={valor.bonos} onChange={set("bonos")} rows={3} maxLength={1500} className={`${inp} resize-y`}
              placeholder={"Ej. Precio congelado en la mentoría\nSesión en vivo de lanzamiento"} />
          </label>
          <p className="sm:col-span-2 text-[11px] text-white/40 leading-relaxed">
            Quien compra en preventa aparta su lugar y no ve lecciones hasta que lances el curso. Al llenarse el cupo o pasar la fecha, la preventa se cierra sola; al lanzar, el precio vuelve al normal.
          </p>
        </div>
      )}
    </div>
  );
}
