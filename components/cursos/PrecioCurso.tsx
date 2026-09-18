import { Clock, Lock } from "lucide-react";
import { descuentoPct, pesos, textoCierre, type Venta } from "@/lib/cursos-tipos";

/*
 * El precio de un curso según su estado de venta (lo calcula el servidor con
 * `estadoVenta`): en preventa, precio fundador con el regular tachado, lugares
 * y cierre; cerrada, cuándo abre; a la venta, el precio normal. Sin hooks:
 * sirve en la página de venta, en el inicio y en el banco de pruebas.
 */
export function PrecioCurso({ venta, className = "" }: { venta: Venta; className?: string }) {
  if (venta.estado === "preventa" && venta.precio) {
    const desc = descuentoPct(venta.precio, venta.precioRegular);
    const vendidos = venta.cupo && venta.quedan != null ? venta.cupo - venta.quedan : 0;
    return (
      <div className={className}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-lgb-red mb-1">Precio de fundador</p>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-coolvetica text-4xl">{pesos(venta.precio)} <span className="text-base text-white/60">MXN</span></span>
          {venta.precioRegular && <s className="text-white/40">{pesos(venta.precioRegular)}</s>}
          {desc && <span className="text-[11px] px-2 py-0.5 rounded-full bg-lgb-red text-white">−{desc}%</span>}
        </p>
        {venta.precioRegular && <p className="text-xs text-white/50 mt-1">Al lanzar, el curso cuesta {pesos(venta.precioRegular)} MXN.</p>}
        {venta.cupo && venta.quedan != null && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-lgb-red rounded-full" style={{ width: `${Math.min(100, Math.round((vendidos / venta.cupo) * 100))}%` }} />
            </div>
            <p className="text-xs text-white/70 mt-1.5">Quedan <span className="font-medium text-white">{venta.quedan}</span> de {venta.cupo} lugares de fundador</p>
          </div>
        )}
        {venta.diasParaCierre != null && (
          <p className="flex items-center gap-1.5 text-xs text-white/70 mt-2">
            <Clock size={13} className="text-lgb-red" /> La preventa {textoCierre(venta.diasParaCierre).toLowerCase()}
          </p>
        )}
      </div>
    );
  }

  if (venta.estado === "preventa_cerrada") {
    return (
      <div className={className}>
        <p className="flex items-center gap-2 font-coolvetica text-2xl"><Lock size={18} className="text-lgb-red" />
          {venta.motivoCierre === "cupo" ? "Preventa llena" : venta.motivoCierre === "fecha" ? "Preventa cerrada" : "Muy pronto"}
        </p>
        <p className="text-sm text-white/60 mt-1">
          {venta.lanzamiento ? `Lanzamiento: ${venta.lanzamiento}.` : "Estamos terminando de grabar."}
          {venta.precioRegular ? ` Precio al lanzar: ${pesos(venta.precioRegular)} MXN.` : ""}
        </p>
      </div>
    );
  }

  if (venta.precio) {
    return (
      <p className={`font-coolvetica text-4xl ${className}`}>{pesos(venta.precio)} <span className="text-base text-white/60">MXN</span></p>
    );
  }
  return null;
}
