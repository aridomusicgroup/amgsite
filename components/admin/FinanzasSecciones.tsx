"use client";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { PieChart, CalendarClock, Receipt } from "lucide-react";

/**
 * Las tres áreas de Finanzas.
 *
 * Antes era una sola columna con seis bloques apilados, y mezclaba tres
 * preguntas que no se hacen al mismo tiempo: "¿cómo vamos?" (los números y el
 * reparto), "¿qué hay que pagar?" (renta, sueldos, músicos — lo que tiene
 * fecha) y "¿en qué se fue el dinero?" (el registro de cada movimiento). Lo que
 * vence, que es lo único urgente, quedaba a media página entre dos listas.
 *
 * Cada área dice arriba qué contesta. Las tres se montan una sola vez y sólo se
 * ocultan: cambiar de pestaña no tira un formulario a medio llenar ni los
 * filtros que ya pusiste.
 */
const SECCIONES = [
  { id: "resumen", label: "Resumen", icono: PieChart, quien: "Cuánto entró, cuánto salió y cuánto le toca a cada socio." },
  { id: "pagos", label: "Pagos", icono: CalendarClock, quien: "Lo que sale cada semana o cada mes: renta, suscripciones, músicos y sueldos." },
  { id: "movimientos", label: "Movimientos", icono: Receipt, quien: "El registro de cada peso: gastos sueltos y dinero que entró sin cliente." },
] as const;
type SeccionId = (typeof SECCIONES)[number]["id"];

export function FinanzasSecciones({ resumen, pagos, movimientos, porPagar }: {
  resumen: ReactNode;
  pagos: ReactNode;
  movimientos: ReactNode;
  /** Cuántas cosas vencen o ya se vencieron: se pinta en la pestaña Pagos. */
  porPagar: number;
}) {
  // La pestaña se puede pedir por URL (?seccion=pagos): así el push de "se
  // vence la renta" abre directo donde se marca como pagada.
  const pedida = useSearchParams().get("seccion");
  const [seccion, setSeccion] = useState<SeccionId>(
    SECCIONES.some((x) => x.id === pedida) ? (pedida as SeccionId) : "resumen",
  );
  const elegir = (id: SeccionId) => {
    setSeccion(id);
    // replaceState y no router.replace: la página es force-dynamic y un replace
    // del router la volvería a pedir entera sólo por cambiar de pestaña.
    const url = new URL(window.location.href);
    url.searchParams.set("seccion", id);
    window.history.replaceState(null, "", url);
  };
  const actual = SECCIONES.find((x) => x.id === seccion)!;
  const contenido: Record<SeccionId, ReactNode> = { resumen, pagos, movimientos };

  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {SECCIONES.map((x) => {
          const Icono = x.icono;
          const activa = seccion === x.id;
          return (
            <button key={x.id} onClick={() => elegir(x.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activa ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"
              }`}>
              <Icono size={14} /> {x.label}
              {x.id === "pagos" && porPagar > 0 && (
                <span title={`${porPagar} por pagar`}
                  className={`ml-0.5 min-w-[18px] px-1.5 rounded-full text-[10px] leading-[18px] text-center ${
                    activa ? "bg-white/25 text-white" : "bg-amber-500/20 text-amber-300"
                  }`}>
                  {porPagar}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-white/35 mb-5 px-1">{actual.quien}</p>

      {SECCIONES.map((x) => (
        <div key={x.id} hidden={x.id !== seccion}>{contenido[x.id]}</div>
      ))}
    </div>
  );
}
