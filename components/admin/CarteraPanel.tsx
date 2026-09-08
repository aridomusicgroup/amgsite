"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, ChevronDown, MailX, CalendarClock } from "lucide-react";
import type { Contacto } from "@/lib/erp-data";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** A partir de aquí la deuda deja de ser "reciente" y empieza a pesar. */
const AMBAR = 31;
const ROJO = 61;

const colorDe = (d: number) =>
  d >= ROJO ? "text-red-300" : d >= AMBAR ? "text-amber-300" : "text-white/60";

const anillo = (d: number) =>
  d >= ROJO ? "border-red-500/25 bg-red-500/[0.06]" : d >= AMBAR ? "border-amber-500/25 bg-amber-500/[0.06]" : "border-white/8 bg-white/[0.03]";

/**
 * Quién nos debe, cuánto y desde cuándo.
 *
 * Vive en Clientes y no en Ventas a propósito: aquí está el historial completo
 * de cada persona, y **se cobra a personas, no a folios**. `getVentas()` da el
 * saldo suelto por venta, así que un cliente con dos ventas parciales se
 * acababa persiguiendo dos veces; y la pantalla que sí tiene su historia no
 * mostraba dinero en absoluto.
 *
 * **Ordena por antigüedad, no por monto.** La lista de Clientes ordena por LTV,
 * que es lo correcto para vender y lo incorrecto para cobrar: $1,000 detenidos
 * 76 días son más urgentes que $8,375 de hace 25, porque lo viejo es lo que ya
 * no se cobra. Dentro de la misma cubeta de edad sí manda el monto.
 */
export function CarteraPanel({ contactos }: { contactos: Contacto[] }) {
  const [abierto, setAbierto] = useState(true);

  const deudores = useMemo(
    () =>
      contactos
        .filter((c) => c.saldo > 0.5)
        .sort((a, b) => {
          const cubeta = (d: number) => (d >= ROJO ? 2 : d >= AMBAR ? 1 : 0);
          const dif = cubeta(b.saldoDias) - cubeta(a.saldoDias);
          return dif !== 0 ? dif : b.saldo - a.saldo;
        }),
    [contactos],
  );

  if (!deudores.length) return null;

  const total = deudores.reduce((a, c) => a + c.saldo, 0);
  const viejos = deudores.filter((c) => c.saldoDias >= AMBAR);
  const sinSeguimiento = deudores.filter((c) => !c.proximaAccion);

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-lgb-surface overflow-hidden">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
        <CircleDollarSign size={16} className="text-amber-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/85">
            Por cobrar: <b className="text-amber-300">{peso(total)}</b>
            <span className="text-white/40"> · {deudores.length} cliente{deudores.length === 1 ? "" : "s"}</span>
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {viejos.length > 0 && <>{viejos.length} con más de {AMBAR - 1} días · </>}
            {sinSeguimiento.length > 0
              ? `${sinSeguimiento.length} sin seguimiento puesto`
              : "todos con seguimiento"}
          </p>
        </div>
        <ChevronDown size={16} className={`text-white/30 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-1.5">
          {deudores.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 ${anillo(c.saldoDias)}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85 truncate">
                  {c.nombre || c.email || "Sin nombre"}
                  {c.etapa === "recurrente" && (
                    <span className="ml-1.5 text-[10px] text-white/35">recurrente</span>
                  )}
                </p>
                <p className="text-[11px] text-white/35 truncate flex items-center gap-1.5">
                  {c.proximaAccion
                    ? <><CalendarClock size={10} /> {c.proximaAccion}</>
                    : <span className="text-amber-200/70">sin seguimiento puesto</span>}
                  {!c.email && <><MailX size={10} className="text-amber-300/70" /> sin correo</>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-coolvetica text-white/90">{peso(c.saldo)}</p>
                <p className={`text-[11px] ${colorDe(c.saldoDias)}`}>
                  {c.saldoDias === 0 ? "de hoy" : `hace ${c.saldoDias} d`}
                </p>
              </div>
            </div>
          ))}

          <p className="text-[11px] text-white/25 pt-1.5 leading-relaxed">
            Ordenado por antigüedad y luego por monto — lo viejo es lo que ya no se cobra.
            El saldo sale de las ventas con pagos registrados; las que no tienen ninguno se
            cuentan como cobradas, y ésas se revisan en{" "}
            <Link href="/admin/ventas" className="text-white/50 hover:text-white underline">Ventas</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
