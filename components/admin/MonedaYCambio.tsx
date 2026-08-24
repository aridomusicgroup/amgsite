"use client";
import { ArrowRight } from "lucide-react";
import { MONEDAS, esExtranjera, aMxn, factorConversion } from "@/lib/tipo-cambio";

/**
 * Selector de moneda + tipo de cambio, con el equivalente en pesos calculado en
 * vivo. Se comparte entre cotizaciones, contratos y ventas para que los tres
 * conviertan igual y muestren lo mismo.
 *
 * El campo del tipo de cambio solo aparece cuando la moneda NO es peso: pedirlo
 * en una cotización en pesos es ruido, y un 17 olvidado ahí sería una bomba.
 */
export function MonedaYCambio({
  moneda, setMoneda, tipoCambio, setTipoCambio, monto, sugerido, etiquetaMonto = "Total", onReexpresar,
}: {
  moneda: string;
  setMoneda: (v: string) => void;
  tipoCambio: string;
  setTipoCambio: (v: string) => void;
  /** Monto en la moneda elegida, para enseñar la conversión. */
  monto: number;
  /** Promedio de las últimas ventas; se propone al cambiar a dólares. */
  sugerido: number;
  etiquetaMonto?: string;
  /**
   * Reescribe los importes del documento en la nueva moneda.
   *
   * Cambiar el selector NO cambia lo que vale el trabajo: si cotizaste 6,000
   * pesos y eliges USD, se vuelve a expresar como ~$359 USD. Sin esto, el 6,000
   * se quedaría igual y de golpe estarías cobrando 6,000 dólares.
   */
  onReexpresar?: (factor: number) => void;
}) {
  const extranjera = esExtranjera(moneda);
  const tc = Number(tipoCambio) || 0;
  const enPesos = aMxn(monto, moneda, tc);

  const cambiarMoneda = (v: string) => {
    // El tipo de cambio a usar: el que ya está escrito, o el promedio si se va
    // a dólares por primera vez.
    const tcUsar = tc > 0 ? tc : sugerido;
    if (esExtranjera(v) && !(tc > 0)) setTipoCambio(String(sugerido));

    const factor = factorConversion(moneda, v, tcUsar);
    if (factor) onReexpresar?.(factor);
    setMoneda(v);
  };

  return (
    <div className="mt-2">
      <div className={`grid gap-3 ${extranjera ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="text-white/60 text-xs">Moneda</label>
          <select value={moneda} onChange={(e) => cambiarMoneda(e.target.value)} className="input cursor-pointer mt-1">
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {extranjera && (
          <div>
            <label className="text-white/60 text-xs">
              Tipo de cambio <span className="text-white/30">(prom. {sugerido})</span>
            </label>
            <input
              type="number" step="any" min={0} inputMode="decimal"
              value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)}
              placeholder={String(sugerido)} className="input mt-1"
            />
          </div>
        )}
      </div>

      {extranjera && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="text-white/40 text-xs">{etiquetaMonto} en {moneda}</span>
          <span className="text-sm text-white/80">
            ${monto.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <ArrowRight size={13} className="text-white/25 shrink-0" />
          {tc > 0 ? (
            <span className="text-sm font-medium text-green-300">
              ${enPesos.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          ) : (
            <span className="text-xs text-amber-300">Falta el tipo de cambio</span>
          )}
        </div>
      )}
    </div>
  );
}
