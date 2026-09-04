"use client";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { money } from "@/components/admin/ui";
import type { ProyectoDetalle } from "@/lib/erp-data";

const ESTADO_LABEL: Record<string, string> = { borrador: "Borrador", enviado: "Enviado", firmado: "Firmado", cancelado: "Cancelado" };
const ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-white/8 text-white/50", enviado: "bg-amber-500/15 text-amber-300",
  firmado: "bg-green-500/15 text-green-300", cancelado: "bg-red-500/10 text-red-300/70",
};

/** Solo lectura + deep-link: editar contratos/cotizaciones vive en Cotizaciones, con su propio flujo de PDF y firma. */
export function ContratoTab({ proyecto }: { proyecto: ProyectoDetalle }) {
  return (
    <div className="space-y-4">
      {proyecto.cotizacion && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/35 uppercase tracking-wider">Cotización</p>
            <p className="text-white text-sm mt-1">{proyecto.cotizacion.folio ?? "Sin folio"} · {ESTADO_LABEL[proyecto.cotizacion.estado] ?? proyecto.cotizacion.estado}</p>
          </div>
          <Link href={`/admin/cotizaciones?destacar=${proyecto.cotizacion.id}`} className="text-white/40 hover:text-white text-xs flex items-center gap-1">Ver <ExternalLink size={12} /></Link>
        </div>
      )}

      {proyecto.contratos.length === 0 ? (
        <p className="text-sm text-white/30">Sin contrato todavía. Se genera solo al marcar el proyecto como entregado (solo beats personalizados), o puedes crearlo a mano en Cotizaciones.</p>
      ) : (
        <div className="space-y-2">
          {proyecto.contratos.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-white/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{c.folio ?? "Sin folio"}</p>
                  <p className="text-white/40 text-xs">{money(c.monto)} {c.moneda ?? "MXN"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado] ?? "bg-white/8 text-white/50"}`}>{ESTADO_LABEL[c.estado] ?? c.estado}</span>
                <Link href={`/admin/cotizaciones?vista=contratos&destacar=${c.id}`} className="text-white/40 hover:text-white" title="Ver / editar en Cotizaciones"><ExternalLink size={13} /></Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
