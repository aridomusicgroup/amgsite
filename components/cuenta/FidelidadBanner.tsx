import { Sparkles } from "lucide-react";
import type { FidelidadCliente } from "@/lib/fidelidad-server";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Aviso personalizado del nivel de fidelidad en /cuenta.
 *
 * Solo se muestra si tiene algo que enseñar: nivel 0 sin crédito es su
 * primera visita, y mostrarle "0% de descuento" ahí no vende nada, solo
 * ocupa espacio. Aparece en cuanto compra algo pagado de una sola vez.
 */
export function FidelidadBanner({ fidelidad }: { fidelidad: FidelidadCliente }) {
  if (fidelidad.nivel === 0 && fidelidad.creditoDisponible <= 0) return null;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3.5 mb-5">
      <div className="flex items-start gap-2.5">
        <Sparkles size={16} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm text-white/85">
            <b className="text-amber-200">{fidelidad.descuentoPct}% de descuento</b> en tu próximo proyecto a la
            medida pagado de contado.
          </p>
          <p className="text-[12px] text-white/45 mt-1">
            Cada compra que pagas completa suma a tu nivel — nunca baja.
            {fidelidad.faltanParaSubir != null && (
              <> Te faltan <b className="text-white/60">{fidelidad.faltanParaSubir}</b> más para subir de nivel.</>
            )}
          </p>
          {fidelidad.creditoDisponible > 0 && (
            <p className="text-[12px] text-green-300/80 mt-1">
              Tienes {peso(fidelidad.creditoDisponible)} de crédito disponible para tu próxima cotización.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
