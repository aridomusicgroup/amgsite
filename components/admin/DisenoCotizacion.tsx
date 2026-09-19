"use client";
import { useMemo } from "react";
import { margen, validarCosto } from "@/lib/diseno";
import type { ProyectoTema } from "@/lib/cotizaciones-data";

const pesos = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`;

/**
 * Lo de diseño visual dentro del modal de cotización: a qué canción nuestra
 * pertenece y cuánto se le paga al diseñador, con lo que nos queda en vivo.
 *
 * El pago se sugiere del catálogo (`costoSugerido`) mientras nadie lo toque;
 * al escribirlo queda fijo, y "usar el del catálogo" lo regresa.
 */
export function DisenoCotizacion({
  proyectos, contactoId, origenId, onOrigen, costo, sugerido, manual, onCosto, totalMxn, proveedor,
}: {
  proyectos: ProyectoTema[];
  contactoId: string | null;
  origenId: string;
  onOrigen: (id: string) => void;
  /** Lo que se le va a pagar (el escrito o el sugerido). */
  costo: number;
  sugerido: number;
  /** true = lo escribió alguien; false = sigue al catálogo. */
  manual: boolean;
  /** null = volver al del catálogo. */
  onCosto: (v: number | null) => void;
  totalMxn: number;
  proveedor: string;
}) {
  const nombre = proveedor.split(" ")[0] || "diseñador";

  // Los del cliente primero: casi siempre el diseño es de una canción suya.
  const { suyos, otros } = useMemo(() => {
    const suyos = contactoId ? proyectos.filter((p) => p.contacto_id === contactoId) : [];
    const ids = new Set(suyos.map((p) => p.id));
    return { suyos, otros: proyectos.filter((p) => !ids.has(p.id)) };
  }, [proyectos, contactoId]);

  const problema = validarCosto(costo, totalMxn);
  const queda = margen(totalMxn, costo);
  const etiqueta = (p: ProyectoTema, conCliente: boolean) =>
    `${p.folio ?? "—"} · ${p.titulo}${conCliente && p.cliente ? ` (${p.cliente})` : ""}`;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] font-medium text-white/70">Diseño visual</p>

      <label className="block mt-2">
        <span className="text-white/60 text-xs">¿De qué tema es? <span className="text-white/45">(si lo produjimos)</span></span>
        <select value={origenId} onChange={(e) => onOrigen(e.target.value)} className="input cursor-pointer mt-1">
          <option value="">No lo produjimos / sin tema</option>
          {suyos.length > 0 && (
            <optgroup label="De este cliente">
              {suyos.map((p) => <option key={p.id} value={p.id}>{etiqueta(p, false)}</option>)}
            </optgroup>
          )}
          <optgroup label={suyos.length ? "Otros proyectos" : "Proyectos"}>
            {otros.map((p) => <option key={p.id} value={p.id}>{etiqueta(p, true)}</option>)}
          </optgroup>
        </select>
      </label>

      <label className="block mt-2.5">
        <span className="text-white/60 text-xs">
          Pago a {nombre} <span className="text-white/45">(en pesos · queda pendiente en Finanzas → Pagos al vender)</span>
        </span>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <div className="w-36">
            <input
              type="number" min={0} step="any" value={costo}
              onChange={(e) => onCosto(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0))}
              className="input"
            />
          </div>
          {manual && Math.abs(costo - sugerido) > 0.5 && (
            <button type="button" onClick={() => onCosto(null)}
              className="text-xs text-white/60 hover:text-white underline underline-offset-2 cursor-pointer">
              usar el del catálogo ({pesos(sugerido)})
            </button>
          )}
        </div>
      </label>

      {problema ? (
        <p className="text-red-400 text-xs font-medium mt-1.5">{problema}</p>
      ) : costo === 0 ? (
        <p className="text-amber-300 text-xs font-medium mt-1.5">
          Sin pago a {nombre}: escríbelo si esta cotización lleva trabajo suyo.
        </p>
      ) : (
        <p className="text-green-300 text-xs font-medium mt-1.5">
          Nos queda {pesos(queda.monto)} ({queda.pct}% del total)
        </p>
      )}
    </div>
  );
}
