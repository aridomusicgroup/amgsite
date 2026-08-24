import type { PagoMusicoRow } from "@/lib/erp-data";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const fechaCorta = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—";
// Los pagos auto-generados guardan el instrumento en la nota ("Auto: tololoche").
const instrumentoDe = (nota: string | null): string => {
  const m = String(nota || "").match(/^auto:\s*(.+)$/i);
  return m ? m[1].trim() : "";
};

/**
 * Vista de solo lectura de los pagos a músicos (COGS). Se editan desde cada
 * venta (Ventas → ⋯ → Pagos a músicos). Aquí solo se ven, con total y pendiente.
 */
export function PagosMusicoResumen({ pagos, total, pendiente }: { pagos: PagoMusicoRow[]; total: number; pendiente: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-coolvetica text-xl mb-1">Pagos a músicos ({pagos.length})</h2>
          <p className="text-white/40 text-sm">Costo directo de sesión. Se descuenta de la utilidad del reparto. Edítalos en cada venta.</p>
        </div>
        <p className="text-sm text-right">
          <span className="text-white/50">Total </span><span className="text-white/85 font-medium">{peso(total)}</span>
          {pendiente > 0 && <><br /><span className="text-amber-300 text-xs">{peso(pendiente)} pendiente por pagar</span></>}
        </p>
      </div>

      {pagos.length === 0 ? (
        <p className="text-white/30 text-sm py-4">Aún no hay pagos a músicos registrados.</p>
      ) : (
        <ul className="space-y-1.5">
          {pagos.map((p) => {
            const instrumento = instrumentoDe(p.nota);
            const detalle = [p.venta, p.beat, p.cliente].filter(Boolean).join(" · ");
            return (
              <li key={p.id} className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${p.pagado ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
                    {p.pagado ? "Pagado" : "Pendiente"}
                  </span>
                  <span className="text-white/85 min-w-0 truncate">{p.musico || "Músico"}</span>
                  {instrumento && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lgb-red/15 text-red-200 shrink-0">{instrumento}</span>}
                  <span className="text-white/35 text-xs shrink-0">{fechaCorta(p.fecha)}</span>
                  <span className="ml-auto text-white font-medium shrink-0">{peso(p.monto)}</span>
                </div>
                {(detalle || p.proyecto) && (
                  <p className="text-white/35 text-[11px] mt-1 truncate">
                    {detalle}
                    {p.proyecto && <span className="text-white/45"> · 🎬 {p.proyecto}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
