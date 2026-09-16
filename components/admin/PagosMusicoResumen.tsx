"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import type { PagoMusicoRow, VentaParaPago } from "@/lib/erp-data";
import { MEDIOS_PAGO } from "@/lib/medios-pago";
import { restaPorPagar, totalAbonado } from "@/lib/abonos-musico";
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
  const [parte, setParte] = useState(false); // false = todo lo que resta · true = sólo una parte
  const [cuanto, setCuanto] = useState("");
  const [busy, setBusy] = useState(false);
  const instrumento = instrumentoDe(p.nota);
  const detalle = [p.venta, p.beat, p.cliente].filter(Boolean).join(" · ");
  const abonado = totalAbonado(p.abonos);
  const resta = restaPorPagar(p.monto, p.pagado, p.abonos);

  const marcarPagado = async () => {
    if (!medio) { toast("Elige el medio de pago"); return; }
    const monto = parte ? Number(cuanto) : resta;
    if (parte && !(monto > 0 && monto < resta)) { toast(`La parte debe ser mayor a 0 y menor a ${peso(resta)}`); return; }
    setBusy(true);
    // Con anticipos previos, liquidar también es un abono: así queda la historia completa.
    const err = parte || abonado > 0
      ? await enviar("PATCH", { id: p.id, abono: { monto, medio_pago: medio, fecha: hoy() } })
      : await enviar("PATCH", { id: p.id, pagado: true, medio_pago: medio, fecha: hoy() });
    setBusy(false);
    if (err) { toast("⚠️ " + err); return; }
    toast(parte ? `✓ Anticipo de ${peso(monto)} a ${p.musico || "músico"} · resta ${peso(resta - monto)}` : `✓ Pagado a ${p.musico || "músico"}`);
    setPagando(false);
    setParte(false);
    setCuanto("");
    router.refresh();
  };

  return (
    <li className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-3 text-sm">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${p.pagado ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
          {p.pagado ? "Pagado" : abonado > 0 ? "Con anticipo" : "Pendiente"}
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
      {p.abonos.length > 0 && (
        <p className="text-[11px] mt-1 text-white/55">
          {p.abonos.map((a, i) => (
            <span key={i} className="mr-2">Anticipo {peso(a.monto)} · {fechaCorta(a.fecha)}{a.medio_pago ? ` · ${a.medio_pago}` : ""}</span>
          ))}
          {!p.pagado && <b className="text-amber-300 font-medium">Resta {peso(resta)}</b>}
        </p>
      )}
      {pagando && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1.5" role="group" aria-label="Cuánto se le paga">
            {[{ v: false, t: `Todo (${peso(resta)})` }, { v: true, t: "Sólo una parte" }].map((o) => (
              <button key={String(o.v)} type="button" onClick={() => setParte(o.v)} aria-pressed={parte === o.v}
                className={`rounded-full px-3 py-1 text-xs ${parte === o.v ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
                {o.t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {parte && (
              <input type="number" min={0} step="any" value={cuanto} onChange={(e) => setCuanto(e.target.value)} autoFocus
                placeholder={`¿Cuánto? (mitad ${peso(resta / 2)})`} aria-label="Monto del anticipo"
                className="w-44 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
            )}
            <select value={medio} onChange={(e) => setMedio(e.target.value)} aria-label="Medio de pago"
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm">
              <option value="" className="bg-lgb-dark">¿Cómo se le pagó?</option>
              {MEDIOS_PAGO.map((m) => <option key={m} value={m} className="bg-lgb-dark">{m}</option>)}
            </select>
            <button onClick={marcarPagado} disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-lgb-red hover:bg-red-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {parte ? "Registrar anticipo" : "Marcar pagado hoy"}
            </button>
            <button onClick={() => setPagando(false)} className="text-xs text-white/45 hover:text-white">Cancelar</button>
          </div>
        </div>
      )}
    </li>
  );
}

type EstadoPago = "pagado" | "parte" | "pendiente";
const ESTADOS: { v: EstadoPago; t: string }[] = [
  { v: "pagado", t: "Ya se le pagó todo" },
  { v: "parte", t: "Le di una parte" },
  { v: "pendiente", t: "Queda pendiente" },
];
const VACIO = { ventaId: "", musico: "", monto: "", estado: "pagado" as EstadoPago, anticipo: "", medio: "", fecha: hoy() };

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
    const total = Number(f.monto);
    const anticipo = Number(f.anticipo);
    if (f.estado === "parte" && !(anticipo > 0 && anticipo < total)) {
      setError(`La parte que le diste debe ser mayor a 0 y menor a ${peso(total)}.`); return;
    }
    if (f.estado !== "pendiente" && !f.medio) { setError("Elige cómo se le pagó."); return; }
    setSaving(true);
    setError(null);
    const pagado = f.estado === "pagado";
    const err = await enviar("POST", {
      venta_id: f.ventaId, musico: f.musico.trim(), monto: f.monto,
      pagado, medio_pago: pagado ? f.medio : "", fecha: pagado ? f.fecha : null,
      ...(f.estado === "parte" ? { anticipo, anticipo_medio: f.medio, anticipo_fecha: f.fecha } : {}),
    });
    setSaving(false);
    if (err) { setError(err); return; }
    toast(f.estado === "pagado" ? "✓ Pago a músico registrado"
      : f.estado === "parte" ? `✓ Anticipo de ${peso(anticipo)} · resta ${peso(total - anticipo)}`
      : "✓ Registrado como pendiente");
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

        <fieldset className="flex flex-wrap gap-2" aria-label="Estado del pago">
          {ESTADOS.map((o) => (
            <button key={o.v} type="button" onClick={() => setF((p) => ({ ...p, estado: o.v }))}
              aria-pressed={f.estado === o.v}
              className={`rounded-full px-3.5 py-1.5 text-sm ${f.estado === o.v ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
              {o.t}
            </button>
          ))}
        </fieldset>

        {f.estado === "parte" && (
          <div>
            <label className={lbl}>¿Cuánto le diste? *</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="number" min={0} step="any" value={f.anticipo}
                onChange={(e) => setF((p) => ({ ...p, anticipo: e.target.value }))}
                placeholder="0" className={`${inp} max-w-40`} />
              {Number(f.monto) > 0 && (
                <>
                  <button type="button" onClick={() => setF((p) => ({ ...p, anticipo: String(Math.round(Number(p.monto) / 2)) }))}
                    className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/65 hover:text-white">
                    La mitad ({peso(Number(f.monto) / 2)})
                  </button>
                  {Number(f.anticipo) > 0 && Number(f.anticipo) < Number(f.monto) && (
                    <span className="text-sm text-amber-300">Resta {peso(Number(f.monto) - Number(f.anticipo))}</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {f.estado !== "pendiente" && (
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
