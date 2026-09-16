"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import type { PagoMusicoRow, VentaParaPago } from "@/lib/erp-data";
import { MEDIOS_PAGO } from "@/lib/medios-pago";
import { toast } from "@/lib/toast";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const fechaCorta = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—";
// Los pagos auto-generados guardan el instrumento en la nota ("Auto: tololoche").
const instrumentoDe = (nota: string | null): string => {
  const m = String(nota || "").match(/^auto:\s*(.+)$/i);
  return m ? m[1].trim() : "";
};
const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";
const lbl = "block text-[11px] font-medium text-white/55 mb-1.5";

interface MusicoCat { id: string; nombre: string; instrumentos: string[]; tarifa: number; activo: boolean }

async function enviar(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch("/api/admin/pagos-musico", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return d.error || "No se pudo guardar.";
  } catch {
    return "Error de conexión.";
  }
}

function Fila({ p }: { p: PagoMusicoRow }) {
  const router = useRouter();
  const [pagando, setPagando] = useState(false);
  const [medio, setMedio] = useState("");
  const [busy, setBusy] = useState(false);
  const instrumento = instrumentoDe(p.nota);
  const detalle = [p.venta, p.beat, p.cliente].filter(Boolean).join(" · ");

  const marcarPagado = async () => {
    if (!medio) { toast("Elige el medio de pago"); return; }
    setBusy(true);
    const err = await enviar("PATCH", { id: p.id, pagado: true, medio_pago: medio, fecha: hoy() });
    setBusy(false);
    if (err) { toast("⚠️ " + err); return; }
    toast(`✓ Pagado a ${p.musico || "músico"}`);
    setPagando(false);
    router.refresh();
  };

  return (
    <li className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-3 text-sm">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${p.pagado ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
          {p.pagado ? "Pagado" : "Pendiente"}
        </span>
        <span className="text-white/85 min-w-0 truncate">{p.musico || "Músico"}</span>
        {instrumento && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lgb-red/15 text-red-200 shrink-0">{instrumento}</span>}
        <span className="text-white/35 text-xs shrink-0">{fechaCorta(p.fecha)}</span>
        <span className="ml-auto text-white font-medium shrink-0">{peso(p.monto)}</span>
        {!p.pagado && !pagando && (
          <button onClick={() => setPagando(true)}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 px-2.5 py-1 text-xs">
            <Check size={13} /> Pagar
          </button>
        )}
      </div>
      {(detalle || p.proyecto) && (
        <p className="text-white/35 text-[11px] mt-1 truncate">
          {detalle}
          {p.proyecto && <span className="text-white/45"> · 🎬 {p.proyecto}</span>}
        </p>
      )}
      {pagando && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <select value={medio} onChange={(e) => setMedio(e.target.value)} autoFocus aria-label="Medio de pago"
            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm">
            <option value="" className="bg-lgb-dark">¿Cómo se le pagó?</option>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m} className="bg-lgb-dark">{m}</option>)}
          </select>
          <button onClick={marcarPagado} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-lgb-red hover:bg-red-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Marcar pagado hoy
          </button>
          <button onClick={() => setPagando(false)} className="text-xs text-white/45 hover:text-white">Cancelar</button>
        </div>
      )}
    </li>
  );
}

const VACIO = { ventaId: "", musico: "", monto: "", yaPagado: true, medio: "", fecha: hoy() };

/** Registrar un pago a músico sin tener que entrar a la venta. */
function NuevoPagoMusico({ ventas, onClose }: { ventas: VentaParaPago[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState(VACIO);
  const [busca, setBusca] = useState("");
  const [catalogo, setCatalogo] = useState<MusicoCat[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/musicos")
      .then((r) => r.json())
      .then((d) => setCatalogo(Array.isArray(d.musicos) ? d.musicos.filter((m: MusicoCat) => m.activo !== false) : []))
      .catch(() => {});
  }, []);

  const venta = ventas.find((v) => v.id === f.ventaId) ?? null;
  const resultados = useMemo(() => {
    const q = sinAcentos(busca.trim());
    const lista = q
      ? ventas.filter((v) => sinAcentos([v.folio, v.concepto, v.cliente].filter(Boolean).join(" ")).includes(q))
      : ventas;
    return lista.slice(0, 8);
  }, [busca, ventas]);

  // Quién toca lo que lleva esa venta: primero, para elegir con un clic.
  const sugeridos = useMemo(() => {
    const insts = sinAcentos(venta?.extras ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!insts.length) return [];
    return catalogo.filter((m) => (m.instrumentos || []).some((x) => {
      const xl = sinAcentos(String(x));
      return insts.some((i) => i === xl || i.includes(xl) || xl.includes(i));
    }));
  }, [venta, catalogo]);

  const elegirMusico = (nombre: string) => {
    const m = catalogo.find((c) => sinAcentos(c.nombre) === sinAcentos(nombre));
    setF((p) => ({ ...p, musico: nombre, monto: m && Number(m.tarifa) > 0 && !p.monto ? String(m.tarifa) : p.monto }));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.ventaId) { setError("Elige de qué venta es el pago."); return; }
    if (!f.musico.trim()) { setError("Escribe a qué músico."); return; }
    if (!(Number(f.monto) > 0)) { setError("Pon un monto válido."); return; }
    if (f.yaPagado && !f.medio) { setError("Elige cómo se le pagó."); return; }
    setSaving(true);
    setError(null);
    const err = await enviar("POST", {
      venta_id: f.ventaId, musico: f.musico.trim(), monto: f.monto,
      pagado: f.yaPagado, medio_pago: f.yaPagado ? f.medio : "", fecha: f.yaPagado ? f.fecha : null,
    });
    setSaving(false);
    if (err) { setError(err); return; }
    toast(f.yaPagado ? "✓ Pago a músico registrado" : "✓ Registrado como pendiente");
    router.refresh();
    onClose();
  };

  return (
    <form onSubmit={guardar} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-coolvetica text-lg">Registrar pago a músico</h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={lbl}>¿De qué venta? *</label>
          {venta ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <b className="text-white/90">{venta.folio}</b>
                <span className="text-white/50"> · {[venta.concepto, venta.cliente].filter(Boolean).join(" · ")}</span>
              </span>
              <button type="button" onClick={() => setF((p) => ({ ...p, ventaId: "" }))}
                className="ml-auto shrink-0 text-xs text-white/50 hover:text-white">Cambiar</button>
            </div>
          ) : (
            <>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
                placeholder="Busca por folio, cliente o beat (I0086, Juan José…)" className={inp} />
              <ul className="mt-1.5 max-h-56 overflow-y-auto scroll-sutil rounded-xl border border-white/8 divide-y divide-white/5">
                {resultados.length === 0 && <li className="px-3 py-2.5 text-sm text-white/35">Ninguna venta coincide.</li>}
                {resultados.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setF((p) => ({ ...p, ventaId: v.id }))}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
                      <b className="shrink-0 text-white/85 tabular-nums">{v.folio || "—"}</b>
                      <span className="min-w-0 truncate text-white/55">{[v.concepto, v.cliente].filter(Boolean).join(" · ")}</span>
                      <span className="ml-auto shrink-0 text-xs text-white/30">{fechaCorta(v.fecha)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={lbl}>Músico *</label>
            <input list="musicos-finanzas" value={f.musico} onChange={(e) => elegirMusico(e.target.value)}
              placeholder="Jorge, Adal…" className={inp} />
            <datalist id="musicos-finanzas">
              {catalogo.map((m) => <option key={m.id} value={m.nombre} />)}
            </datalist>
            {sugeridos.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sugeridos.map((m) => (
                  <button key={m.id} type="button" onClick={() => elegirMusico(m.nombre)}
                    className={`rounded-full px-2.5 py-1 text-xs ${sinAcentos(f.musico) === sinAcentos(m.nombre) ? "bg-lgb-red/25 text-white" : "bg-white/8 text-white/65 hover:text-white"}`}>
                    {m.nombre} · {(m.instrumentos || []).join(", ")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={lbl}>Monto (MXN) *</label>
            <input type="number" min={0} step="any" value={f.monto} onChange={(e) => setF((p) => ({ ...p, monto: e.target.value }))}
              placeholder="0" className={inp} />
          </div>
        </div>

        <fieldset className="flex gap-2" aria-label="Estado del pago">
          {[{ v: true, t: "Ya se le pagó" }, { v: false, t: "Queda pendiente" }].map((o) => (
            <button key={String(o.v)} type="button" onClick={() => setF((p) => ({ ...p, yaPagado: o.v }))}
              aria-pressed={f.yaPagado === o.v}
              className={`rounded-full px-3.5 py-1.5 text-sm ${f.yaPagado === o.v ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
              {o.t}
            </button>
          ))}
        </fieldset>

        {f.yaPagado && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>¿Cómo se le pagó? *</label>
              <select value={f.medio} onChange={(e) => setF((p) => ({ ...p, medio: e.target.value }))} className={inp}>
                <option value="" className="bg-lgb-dark">— elige —</option>
                {MEDIOS_PAGO.map((m) => <option key={m} value={m} className="bg-lgb-dark">{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" value={f.fecha} onChange={(e) => setF((p) => ({ ...p, fecha: e.target.value }))} className={inp} />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          {saving && <Loader2 size={15} className="animate-spin" />} Guardar pago
        </button>
        <p className="text-xs text-white/35">Se suma al costo de esa venta y se descuenta del reparto.</p>
      </div>
    </form>
  );
}

/**
 * Pagos a músicos (COGS). Se registran aquí o desde cada venta; los dos
 * caminos usan la misma API, que recalcula el costo de la venta.
 *
 * Lo pendiente va arriba y lo ya pagado se pliega: de 31 renglones, los que
 * piden algo eran 8, y quedaban revueltos con los otros 23.
 */
export function PagosMusicoResumen({ pagos, ventas, total, pendiente, pendientes }: {
  pagos: PagoMusicoRow[]; ventas: VentaParaPago[]; total: number; pendiente: number; pendientes: number;
}) {
  const [nuevo, setNuevo] = useState(false);
  const porPagar = pagos.filter((p) => !p.pagado);
  const pagados = pagos.filter((p) => p.pagado);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-coolvetica text-xl mb-1">Pagos a músicos ({pagos.length})</h2>
          <p className="text-white/40 text-sm">Costo directo de sesión. Se descuenta de la utilidad del reparto.</p>
        </div>
        <p className="text-sm text-right">
          <span className="text-white/50">Total </span><span className="text-white/85 font-medium">{peso(total)}</span>
          {pendiente > 0 && <><br /><span className="text-amber-300 text-xs">{peso(pendiente)} pendiente por pagar ({pendientes})</span></>}
        </p>
      </div>

      {nuevo ? (
        <NuevoPagoMusico ventas={ventas} onClose={() => setNuevo(false)} />
      ) : (
        <button onClick={() => setNuevo(true)}
          className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white/15 transition-all mb-4">
          <Plus size={15} /> Registrar pago a músico
        </button>
      )}

      {pagos.length === 0 ? (
        <p className="text-white/30 text-sm py-4">Aún no hay pagos a músicos registrados.</p>
      ) : (
        <>
          {porPagar.length > 0 ? (
            <ul className="space-y-1.5">{porPagar.map((p) => <Fila key={p.id} p={p} />)}</ul>
          ) : (
            <p className="text-green-300/70 text-sm py-2">✓ No se le debe nada a ningún músico.</p>
          )}
          {pagados.length > 0 && (
            <details className="mt-3 group">
              <summary className="text-xs text-white/40 hover:text-white cursor-pointer select-none">
                {pagados.length} ya pagado{pagados.length === 1 ? "" : "s"}
              </summary>
              <ul className="space-y-1.5 mt-2">{pagados.map((p) => <Fila key={p.id} p={p} />)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
