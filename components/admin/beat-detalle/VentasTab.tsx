"use client";
import { money } from "@/components/admin/ui";
import type { VentaBeat } from "@/lib/beat-admin";
import { fechaCorta, Pastilla, Seccion } from "./comun";

const VIA: Record<VentaBeat["via"], string> = {
  id: "ligada por el pedido",
  inventario: "ligada por el inventario",
  nombre: "ligada por nombre",
};

function Tarjeta({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="font-coolvetica text-xl leading-none text-white">{valor}</p>
      <p className="text-white/45 text-[11px] mt-1.5">{etiqueta}</p>
    </div>
  );
}

/** Ventas de este beat en todos los canales (BeatStars, WhatsApp, sitio). */
export function VentasTab({ ventas }: { ventas: VentaBeat[] }) {
  const total = ventas.reduce((a, v) => a + v.mxn, 0);
  const porCanal = new Map<string, number>();
  for (const v of ventas) {
    const c = v.canal || "sin canal";
    porCanal.set(c, (porCanal.get(c) ?? 0) + 1);
  }
  const hayPorNombre = ventas.some((v) => v.via === "nombre");

  if (ventas.length === 0) {
    return (
      <Seccion titulo="Ventas" nota="Se buscan en todas las ventas registradas: sitio, BeatStars y WhatsApp.">
        <p className="text-sm text-white/45">Este beat todavía no tiene ventas registradas.</p>
      </Seccion>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tarjeta valor={String(ventas.length)} etiqueta={ventas.length === 1 ? "venta" : "ventas"} />
        <Tarjeta valor={money(total)} etiqueta="ingreso (MXN)" />
        <Tarjeta valor={money(total / ventas.length)} etiqueta="ticket promedio" />
        <Tarjeta valor={fechaCorta(ventas[0]?.fecha)} etiqueta="última venta" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...porCanal.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => (
          <Pastilla key={c}>{c}: {n}</Pastilla>
        ))}
      </div>

      <Seccion
        titulo="Detalle"
        nota={hayPorNombre
          ? "Las ventas no guardan el id del beat: las de BeatStars y WhatsApp se ligan por el nombre del beat. Si ves una que no es, corrige el nombre en Ventas."
          : undefined}
      >
        <ul className="divide-y divide-white/8 -my-1">
          {ventas.map((v) => (
            <li key={v.id} className="py-2.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85 truncate">{v.cliente || "Cliente sin nombre"}</p>
                <p className="text-[12px] text-white/45 flex flex-wrap gap-x-2">
                  <span>{fechaCorta(v.fecha)}</span>
                  {v.folio && <span>· {v.folio.length > 18 ? `${v.folio.slice(0, 18)}…` : v.folio}</span>}
                  <span>· {v.licencia || v.tipo || "—"}</span>
                  {v.canal && <span>· {v.canal}</span>}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {VIA[v.via]}{v.parcial ? " · pedido con varios beats, sólo la parte de éste" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm tabular-nums text-white/85">
                  {v.moneda === "MXN" ? money(v.monto) : `$${v.monto.toLocaleString("es-MX")} ${v.moneda}`}
                </p>
                {v.moneda !== "MXN" && <p className="text-[11px] tabular-nums text-white/35">{money(v.mxn)} MXN</p>}
              </div>
            </li>
          ))}
        </ul>
      </Seccion>
    </div>
  );
}
