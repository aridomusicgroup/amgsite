"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, CircleDollarSign, ListChecks, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/admin/charts";
import { money } from "@/components/admin/ui";
import { ESTADO_PROY_LABEL, type ProyectoDetalle, type SaludEntrega } from "@/lib/erp-data";

const SALUD_LABEL: Record<SaludEntrega, string> = {
  a_tiempo: "A tiempo", en_riesgo: "En riesgo", atrasado: "Atrasado", entregado: "Entregado", sin_fecha: "Sin fecha",
};
const SALUD_COLOR: Record<SaludEntrega, string> = {
  a_tiempo: "bg-green-500/15 text-green-300 border-green-500/25",
  en_riesgo: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  atrasado: "bg-red-500/15 text-red-300 border-red-500/25",
  entregado: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  sin_fecha: "bg-white/5 text-white/40 border-white/10",
};

/** Cuenta un número de 0 al valor final — sutil, respeta reduced-motion (el llamador decide si montar esto o solo imprimir el valor). */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <>{format(display)}</>;
}

function proximaAccion(p: ProyectoDetalle): string | null {
  if (["entregado", "cerrado", "cancelado"].includes(p.estado)) {
    if (p.contratos.some((c) => c.estado === "borrador")) return "Hay un contrato en borrador sin enviar";
    return null;
  }
  if (p.clase === "produccion" && !p.fecha_entrega) return "Sin fecha de entrega comprometida";
  if (p.ventaSaldo > 0.5) return `Saldo pendiente de ${money(p.ventaSaldo)}`;
  if (p.contratos.some((c) => c.estado === "borrador")) return "Hay un contrato en borrador sin enviar";
  return null;
}

export function ResumenTab({ proyecto }: { proyecto: ProyectoDetalle }) {
  const accion = proximaAccion(proyecto);
  const hechas = proyecto.tareas.filter((t) => t.hecho).length;
  const reduce = useReducedMotion();
  const kpiValue = (n: number, format: (n: number) => string) => (reduce ? format(n) : <CountUp value={n} format={format} />);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs px-2.5 py-1 rounded-full border ${SALUD_COLOR[proyecto.saludEntrega]}`}>{SALUD_LABEL[proyecto.saludEntrega]}</span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">{ESTADO_PROY_LABEL[proyecto.estado] ?? proyecto.estado}</span>
      </div>

      {accion && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-sm text-amber-200/90">
          <AlertTriangle size={15} className="shrink-0" /> {accion}
        </motion.div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Avance" value={kpiValue(proyecto.progreso, (n) => `${Math.round(n)}%`)} icon={<ListChecks size={12} />}
          sub={`${hechas}/${proyecto.tareas.length} tareas`} />
        <KpiCard label="Saldo" value={kpiValue(proyecto.ventaSaldo, money)} icon={<CircleDollarSign size={12} />} accent={proyecto.ventaSaldo > 0.5} />
        <KpiCard
          label={proyecto.saludEntrega === "atrasado" ? "Días de atraso" : "Días para entrega"}
          value={proyecto.saludEntrega === "atrasado" ? String(proyecto.diasDeAtraso ?? "—") : String(proyecto.diasParaEntrega ?? "—")}
          icon={<CalendarClock size={12} />}
          accent={proyecto.saludEntrega === "atrasado" || proyecto.saludEntrega === "en_riesgo"}
        />
        <KpiCard label="Ronda de revisión" value={proyecto.revisionActual > 0 ? `R${proyecto.revisionActual}` : "Original"} icon={<ListChecks size={12} />} />
      </div>

      <Cronograma proyecto={proyecto} />
    </div>
  );
}

/** Línea de tiempo simple: inicio → hoy/entrega comprometida → entrega real. */
function Cronograma({ proyecto }: { proyecto: ProyectoDetalle }) {
  const inicio = proyecto.fechaVenta || proyecto.creado;
  const entregado = !!proyecto.fecha_entrega_real;
  const hoy = new Date().toISOString().slice(0, 10);

  const hitos = [
    { label: "Inicio", fecha: inicio, done: true },
    { label: "Entrega comprometida", fecha: proyecto.fecha_entrega, done: entregado || (proyecto.fecha_entrega ? proyecto.fecha_entrega <= hoy : false) },
    { label: entregado ? "Entregado" : "Entrega real", fecha: proyecto.fecha_entrega_real, done: entregado },
  ];

  const fmt = (s: string | null) => s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div>
      <p className="text-[11px] text-white/35 uppercase tracking-wider mb-3">Cronograma</p>
      <div className="relative pl-1">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
        <div className="space-y-4">
          {hitos.map((h, i) => (
            <div key={i} className="relative flex items-start gap-3 pl-6">
              <motion.span
                className={`absolute left-0 top-0.5 w-3.5 h-3.5 rounded-full border-2 ${h.done ? "bg-lgb-red border-lgb-red" : "bg-lgb-dark border-white/25"}`}
                animate={!h.done && i === hitos.findIndex((x) => !x.done) ? { boxShadow: ["0 0 0 0 rgba(196,47,66,0.4)", "0 0 0 6px rgba(196,47,66,0)"] } : {}}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <div>
                <p className={`text-sm ${h.done ? "text-white/80" : "text-white/40"}`}>{h.label}</p>
                <p className="text-xs text-white/35">{fmt(h.fecha)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
