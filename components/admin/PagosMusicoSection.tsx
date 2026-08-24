"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Check, Clock, ChevronUp, X } from "lucide-react";
import { toast } from "@/lib/toast";

interface PagoMusico {
  id: string;
  musico: string | null;
  monto: number;
  fecha: string | null;
  medio_pago: string | null;
  pagado: boolean;
  nota: string | null;
}

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Pagos a músicos de sesión ligados a una venta. Al agregar/editar/borrar, el
 * servidor recalcula `ventas.costo_extra` (= suma) → el reparto entre socios se
 * ajusta solo, sin doble conteo. Solo admin llega a esta pantalla (Ventas).
 */
interface MusicoCat { nombre: string; instrumentos: string[]; tarifa: number; activo: boolean }

export function PagosMusicoSection({ ventaId, extras }: { ventaId: string; extras?: string | null }) {
  const router = useRouter();
  const [pagos, setPagos] = useState<PagoMusico[] | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [catalogo, setCatalogo] = useState<MusicoCat[]>([]);
  const [busy, setBusy] = useState(false);
  const [abierto, setAbierto] = useState(false); // el form de alta arranca colapsado
  const [f, setF] = useState({ musico: "", monto: "", fecha: hoy(), medio_pago: "" });
  const [pagandoId, setPagandoId] = useState<string | null>(null); // fila capturando su medio de pago
  const [medioPago, setMedioPago] = useState("");
  const listId = `musicos-${ventaId}`;
  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/pagos-musico?venta_id=${encodeURIComponent(ventaId)}`);
      const d = await r.json();
      if (r.ok) setPagos(d.pagos ?? []);
      else setPagos([]);
    } catch {
      setPagos([]);
    }
  }, [ventaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Nombres de músicos ya usados → autocompletado del cuadro de texto.
  useEffect(() => {
    fetch("/api/admin/pagos-musico?names=1")
      .then((r) => r.json())
      .then((d) => setNames(Array.isArray(d.names) ? d.names : []))
      .catch(() => {});
  }, []);

  // Catálogo de músicos (proveedores) → sugerencias por instrumentos + autocompletar.
  useEffect(() => {
    fetch("/api/admin/musicos")
      .then((r) => r.json())
      .then((d) => setCatalogo(Array.isArray(d.musicos) ? d.musicos : []))
      .catch(() => {});
  }, []);

  const total = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const pendiente = (pagos ?? []).filter((p) => !p.pagado).reduce((a, p) => a + (Number(p.monto) || 0), 0);

  // Autocompletar = músicos usados ∪ catálogo.
  const allNames = [...new Set([...names, ...catalogo.map((m) => m.nombre)])].sort((a, b) => a.localeCompare(b, "es"));

  // Sugerencias: por cada instrumento de la venta, quién lo toca en el catálogo.
  const instrumentos = String(extras || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const sugerencias: { musico: string; instrumento: string; tarifa: number }[] = [];
  const vistos = new Set<string>();
  for (const inst of instrumentos) {
    const il = inst.toLowerCase();
    for (const m of catalogo) {
      if (m.activo === false) continue;
      const toca = (m.instrumentos || []).some((x) => {
        const xl = String(x).toLowerCase();
        return xl === il || il.includes(xl) || xl.includes(il);
      });
      if (!toca) continue;
      const key = `${m.nombre.toLowerCase()}|${il}`;
      if (!vistos.has(key)) { vistos.add(key); sugerencias.push({ musico: m.nombre, instrumento: inst, tarifa: Number(m.tarifa) || 0 }); }
    }
  }
  const yaPagado = new Set((pagos ?? []).map((p) => (p.musico || "").toLowerCase()));

  const usarSugerencia = (s: { musico: string; tarifa: number }) => {
    setF((prev) => ({ ...prev, musico: s.musico, monto: s.tarifa > 0 ? String(s.tarifa) : prev.monto }));
  };

  // Instrumento que toca un músico en esta venta: del catálogo (cruzado con los
  // instrumentos de la venta) o, si no está, de la nota "Auto: tololoche".
  const instrumentoDe = (p: PagoMusico): string => {
    const m = catalogo.find((c) => c.nombre.toLowerCase() === (p.musico || "").toLowerCase());
    if (m) {
      const enVenta = (m.instrumentos || []).filter((x) =>
        instrumentos.some((inst) => {
          const il = inst.toLowerCase(); const xl = String(x).toLowerCase();
          return xl === il || il.includes(xl) || xl.includes(il);
        }),
      );
      if (enVenta.length) return enVenta.join(", ");
      if ((m.instrumentos || []).length) return m.instrumentos.join(", ");
    }
    const nm = String(p.nota || "").match(/^auto:\s*(.+)$/i);
    return nm ? nm[1].trim() : "";
  };

  const agregar = async () => {
    if (!(Number(f.monto) > 0)) { toast("Pon un monto válido"); return; }
    const esPagado = !!f.medio_pago.trim(); // pagado = tiene medio de pago; vacío = pendiente
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pagos-musico", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venta_id: ventaId, musico: f.musico, monto: f.monto,
          medio_pago: f.medio_pago, pagado: esPagado, fecha: esPagado ? f.fecha : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo guardar"); return; }
      setF({ musico: "", monto: "", fecha: hoy(), medio_pago: "" });
      await cargar();
      router.refresh(); // recalcula reparto/finanzas
      toast(esPagado ? "✓ Pago registrado" : "✓ Registrado como pendiente");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  // Marcar pagado = capturar el medio de pago (obligatorio) → fecha = hoy.
  const abrirPagar = (p: PagoMusico) => { setPagandoId(p.id); setMedioPago(p.medio_pago || ""); };
  const confirmarPagado = async (p: PagoMusico) => {
    const medio = medioPago.trim();
    if (!medio) { toast("Pon el medio de pago"); return; }
    try {
      const r = await fetch("/api/admin/pagos-musico", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, pagado: true, medio_pago: medio, fecha: hoy() }),
      });
      if (r.ok) { setPagandoId(null); setMedioPago(""); await cargar(); router.refresh(); toast("✓ Marcado pagado"); }
      else { const d = await r.json(); toast(d.error || "No se pudo"); }
    } catch { toast("Error de red"); }
  };
  const marcarPendiente = async (p: PagoMusico) => {
    try {
      const r = await fetch("/api/admin/pagos-musico", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, pagado: false, medio_pago: null, fecha: null }),
      });
      if (r.ok) { await cargar(); router.refresh(); toast("Marcado pendiente"); }
    } catch { toast("Error de red"); }
  };

  const borrar = async (id: string) => {
    try {
      const r = await fetch("/api/admin/pagos-musico", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { await cargar(); router.refresh(); toast("✓ Eliminado"); }
    } catch { toast("Error de red"); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/8 select-text">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white/70">🎸 Pagos a músicos</p>
        {pagos !== null && total > 0 && (
          <p className="text-[11px] text-white/50">
            Total <span className="text-white/80">{peso(total)}</span>
            {pendiente > 0 && <span className="text-amber-300"> · {peso(pendiente)} pendiente</span>}
          </p>
        )}
      </div>

      {pagos === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <ul className="space-y-1.5 mb-2">
          {pagos.map((p) => (
            <li key={p.id} className="text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                {/* Pagado = tiene medio. Marcar pagado pide el medio; pagado → clic vuelve a pendiente. */}
                <button
                  onClick={() => (p.pagado ? marcarPendiente(p) : abrirPagar(p))}
                  title={p.pagado ? "Pagado — clic para volver a pendiente" : "Pendiente — clic para registrar el pago"}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] shrink-0 font-medium ${p.pagado ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"}`}
                >
                  {p.pagado ? <><Check size={11} /> Pagado</> : <><Clock size={11} /> Marcar pagado</>}
                </button>
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="text-white/80 truncate">{p.musico || "Músico"}</span>
                  {instrumentoDe(p) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lgb-red/15 text-red-200 shrink-0">{instrumentoDe(p)}</span>}
                  {p.pagado && p.medio_pago && <span className="text-white/35 text-[10px] shrink-0 hidden sm:inline">{p.medio_pago}</span>}
                  {p.fecha && <span className="text-white/35 text-[10px] shrink-0 hidden sm:inline">{p.fecha.slice(5)}</span>}
                </div>
                <span className="text-white font-medium shrink-0">{peso(p.monto)}</span>
                <button onClick={() => borrar(p.id)} className="text-white/25 hover:text-red-300 shrink-0 p-1" title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </div>
              {pagandoId === p.id && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    autoFocus value={medioPago} onChange={(e) => setMedioPago(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarPagado(p); } }}
                    placeholder="Medio de pago (ZELLE, efectivo…)" className={`${inp} flex-1`}
                  />
                  <button onClick={() => confirmarPagado(p)} className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-medium">Pagado</button>
                  <button onClick={() => { setPagandoId(null); setMedioPago(""); }} className="text-white/40 hover:text-white shrink-0 p-1"><X size={13} /></button>
                </div>
              )}
            </li>
          ))}
          {pagos.length === 0 && <li className="text-white/30 text-xs">Aún no hay pagos a músicos en esta venta.</li>}
        </ul>
      )}

      {/* Botón para desplegar el alta de un pago (arranca colapsado) */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="mt-1 flex items-center gap-1.5 text-xs text-lgb-red hover:text-red-300 font-medium"
      >
        {abierto ? <><ChevronUp size={14} /> Ocultar</> : <><Plus size={14} /> Agregar pago a músico</>}
      </button>

      {abierto && (
      <div className="mt-2.5">
      {/* Sugeridos por los instrumentos de esta venta */}
      {sugerencias.length > 0 && (
        <div className="mb-2.5">
          <p className="text-[10px] text-white/40 mb-1.5">Sugeridos por los instrumentos de esta venta{extras ? ` (${extras})` : ""}:</p>
          <div className="flex flex-wrap gap-1.5">
            {sugerencias.map((s, i) => {
              const done = yaPagado.has(s.musico.toLowerCase());
              return (
                <button
                  key={`${s.musico}-${s.instrumento}-${i}`}
                  onClick={() => usarSugerencia(s)}
                  title={done ? "Ya tiene un pago en esta venta" : "Clic para precargar este músico"}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    done ? "border-green-500/25 text-green-300/70 bg-green-500/5" : "border-lgb-red/30 text-red-200 bg-lgb-red/[0.08] hover:bg-lgb-red/[0.16]"
                  }`}
                >
                  {done ? <Check size={11} /> : <Plus size={11} />}
                  <span className="font-medium">{s.musico}</span>
                  <span className="text-white/40">· {s.instrumento}</span>
                  {s.tarifa > 0 && <span className="text-white/40">· {peso(s.tarifa)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Alta rápida — rejilla en móvil, fila en desktop */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-end">
        <input
          value={f.musico}
          onChange={(e) => {
            const value = e.target.value;
            setF((s) => {
              const next = { ...s, musico: value };
              // Autocompleta la tarifa del catálogo al elegir un músico conocido
              // (solo si el monto está vacío, para no pisar lo que escribiste).
              const m = catalogo.find((c) => c.nombre.toLowerCase() === value.trim().toLowerCase());
              if (m && Number(m.tarifa) > 0 && !s.monto.trim()) next.monto = String(m.tarifa);
              return next;
            });
          }}
          placeholder="Músico" list={listId} className={`${inp} w-full col-span-2 sm:w-32`}
        />
        <datalist id={listId}>
          {allNames.map((n) => <option key={n} value={n} />)}
        </datalist>
        <input type="number" step="any" value={f.monto} onChange={(e) => setF((s) => ({ ...s, monto: e.target.value }))} placeholder="Monto" className={`${inp} w-full sm:w-20`} />
        <input value={f.medio_pago} onChange={(e) => setF((s) => ({ ...s, medio_pago: e.target.value }))} placeholder="Medio de pago (vacío = pendiente)" className={`${inp} w-full col-span-2 sm:w-52`} />
        {f.medio_pago.trim() && (
          <input type="date" value={f.fecha} onChange={(e) => setF((s) => ({ ...s, fecha: e.target.value }))} title="Fecha del pago" className={`${inp} w-full col-span-2 sm:w-auto`} />
        )}
        <button onClick={agregar} disabled={busy} className="col-span-2 sm:w-auto flex items-center justify-center gap-1 bg-lgb-red text-white px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
        </button>
      </div>
      <p className="text-white/25 text-[10px] mt-1.5">Con medio de pago se registra como <b className="text-white/40">pagado</b> (con fecha de hoy); vacío queda <b className="text-white/40">pendiente</b>. El total se descuenta del reparto.</p>
      </div>
      )}
    </div>
  );
}
