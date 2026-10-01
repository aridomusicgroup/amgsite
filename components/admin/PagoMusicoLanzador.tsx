"use client";
import { useEffect, useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { MEDIOS_PAGO } from "@/lib/medios-pago";
import { EVENTO_PAGO_MUSICO, PARAM_PAGO_MUSICO, type PreguntaPago } from "@/lib/pago-grabacion-tipos";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Date().toISOString().slice(0, 10);

type Modo = "todo" | "parte";

/**
 * "Ya grabó: ¿le pagas?"
 *
 * Sale al palomear "Grabar {instrumento}" cuando el músico de esa venta tiene
 * su pago pendiente. Montado una vez en el menú, como el cuadro de entrega, y
 * se abre por los mismos dos caminos:
 *   · el evento `arido:pago-musico`, que lanza la palomita (vía atenderRespuesta)
 *     cuando quien palomeó es admin;
 *   · `?pagar_musico=proyecto:tema:instrumento`, a donde lleva el push que les
 *     llega a los admins cuando palomeó alguien más o el portal del músico.
 *
 * No crea un pago nuevo si ya hay uno pendiente: lo abona o lo liquida, así el
 * costo de la venta no se duplica. "Después" no toca nada — sigue pendiente en
 * Finanzas → Pagos como siempre.
 */
export function PagoMusicoLanzador() {
  const [p, setP] = useState<PreguntaPago | null>(null);

  useEffect(() => {
    const alPedir = (e: Event) => setP((e as CustomEvent<PreguntaPago>).detail);
    window.addEventListener(EVENTO_PAGO_MUSICO, alPedir);

    // Se lee de window y no con useSearchParams, por la misma razón que en
    // EntregaLanzador: el menú está en todas las páginas del panel.
    const url = new URL(window.location.href);
    const q = url.searchParams.get(PARAM_PAGO_MUSICO);
    if (q) {
      url.searchParams.delete(PARAM_PAGO_MUSICO);
      window.history.replaceState(null, "", url);
      const [proyectoId, temaId, ...resto] = q.split(":");
      const qs = new URLSearchParams({ proyecto_id: proyectoId, tema_id: temaId ?? "", instrumento: resto.join(":") });
      fetch(`/api/admin/pago-grabacion?${qs}`, { cache: "no-store" })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (!ok) toast(`⚠️ ${d.error || "No se pudo abrir el pago"}`);
          else if (d.pregunta) setP(d.pregunta as PreguntaPago);
          else toast("✓ Ese músico ya está pagado");
        })
        .catch(() => toast("⚠️ No se pudo abrir el pago"));
    }
    return () => window.removeEventListener(EVENTO_PAGO_MUSICO, alPedir);
  }, []);

  if (!p) return null;
  return <CuadroPago key={`${p.proyectoId}:${p.temaId ?? ""}:${p.instrumento}`} p={p} onCerrar={() => setP(null)} />;
}

function CuadroPago({ p, onCerrar }: { p: PreguntaPago; onCerrar: () => void }) {
  const nuevo = p.pagoId === null;
  // En un EP lo natural es dar la parte de este tema; en lo demás, todo.
  const [modo, setModo] = useState<Modo>(p.sugerido < p.pendiente ? "parte" : "todo");
  const [parte, setParte] = useState(String(p.sugerido || ""));
  const [total, setTotal] = useState(String(p.monto || ""));
  const [medio, setMedio] = useState<string>(MEDIOS_PAGO[0]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape" && !enviando) onCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [enviando, onCerrar]);

  // Lo que se debe: en un pago nuevo lo decide quien registra (la tarifa puede
  // venir en cero); en uno existente es lo que falta de ese pago.
  const debe = nuevo ? Number(total) || 0 : p.pendiente;
  const monto = modo === "todo" ? debe : Number(parte) || 0;
  const valido = debe > 0 && monto > 0 && monto - debe <= 0.01;

  const enviar = async (soloRegistrar = false) => {
    setEnviando(true);
    try {
      const r = nuevo
        ? await fetch("/api/admin/pagos-musico", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              venta_id: p.ventaId, musico: p.musico, instrumento: p.instrumento, monto: debe,
              nota: `Grabó ${p.instrumento} · ${p.donde}`,
              ...(soloRegistrar
                ? { pagado: false }
                : modo === "todo"
                  ? { pagado: true, medio_pago: medio, fecha: hoy() }
                  : { pagado: false, anticipo: monto, anticipo_medio: medio, anticipo_fecha: hoy() }),
            }),
          })
        : await fetch("/api/admin/pagos-musico", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.pagoId, abono: { monto, medio_pago: medio, fecha: hoy() } }),
          });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo registrar");
      const resta = Math.max(0, debe - monto);
      toast(soloRegistrar
        ? `✓ Quedó pendiente: ${peso(debe)} a ${p.musico}`
        : resta > 0.01
          ? `✓ Le diste ${peso(monto)} a ${p.musico} · resta ${peso(resta)}`
          : `✓ ${p.musico} quedó pagado`);
      onCerrar();
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo registrar"}`);
    } finally {
      setEnviando(false);
    }
  };

  const opcion = (activo: boolean) =>
    `flex-1 px-3 py-2 rounded-xl text-sm border transition-colors cursor-pointer ${
      activo ? "border-lgb-red/60 bg-lgb-red/10 text-white" : "border-white/10 text-white/60 hover:text-white hover:border-white/20"}`;
  const campo = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lgb-red/60";
  const etiqueta = "block text-[11px] uppercase tracking-wider text-white/35 mb-1";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !enviando && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="pago-musico-t"
        className="w-full max-w-md rounded-2xl bg-lgb-dark border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <span className="w-9 h-9 rounded-xl bg-green-500/15 text-green-300 flex items-center justify-center shrink-0"><Banknote size={17} /></span>
          <div className="min-w-0">
            <p id="pago-musico-t" className="font-coolvetica text-lg leading-tight">¿Le pagas a {p.musico}?</p>
            <p className="text-white/45 text-xs mt-0.5">Ya quedó grabado {p.instrumento} de {p.donde}</p>
          </div>
        </div>

        {nuevo ? (
          <div className="mb-4">
            <p className="text-xs text-white/50 leading-relaxed mb-2">
              Este pago no está registrado en la venta. Se registra con su tarifa; cámbiala si se acordó otra.
            </p>
            <label className={etiqueta} htmlFor="pago-total">Total a pagarle</label>
            <input id="pago-total" type="number" inputMode="decimal" min={0} value={total}
              onChange={(e) => setTotal(e.target.value)} className={campo} />
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 mb-4">
            <p className="text-sm text-white/85">Le debes <span className="font-semibold text-white">{peso(p.pendiente)}</span></p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {p.abonado > 0 ? `De ${peso(p.monto)}; ya le diste ${peso(p.abonado)}.` : `Pago de ${peso(p.monto)} de la venta.`}
              {p.temasRestantes && p.temasRestantes > 1 && ` Le quedan ${p.temasRestantes} temas: la parte de éste es ${peso(p.sugerido)}.`}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-3" role="radiogroup" aria-label="Cuánto le pagas">
          <button role="radio" aria-checked={modo === "todo"} onClick={() => setModo("todo")} className={opcion(modo === "todo")}>
            Todo{debe > 0 ? ` · ${peso(debe)}` : ""}
          </button>
          <button role="radio" aria-checked={modo === "parte"} onClick={() => setModo("parte")} className={opcion(modo === "parte")}>
            Una parte
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {modo === "parte" && (
            <div>
              <label className={etiqueta} htmlFor="pago-parte">Cuánto le diste</label>
              <input id="pago-parte" type="number" inputMode="decimal" min={0} value={parte}
                onChange={(e) => setParte(e.target.value)} className={campo} />
            </div>
          )}
          <div className={modo === "parte" ? "" : "col-span-2"}>
            <label className={etiqueta} htmlFor="pago-medio">Cómo le pagaste</label>
            <select id="pago-medio" value={medio} onChange={(e) => setMedio(e.target.value)} className={campo}>
              {MEDIOS_PAGO.map((m) => <option key={m} value={m} className="bg-lgb-dark">{m}</option>)}
            </select>
          </div>
        </div>
        {modo === "parte" && monto - debe > 0.01 && (
          <p className="text-[11px] text-red-300 -mt-3 mb-4">Es más de lo que se le debe ({peso(debe)}).</p>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button onClick={onCerrar} disabled={enviando} className="px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white cursor-pointer disabled:opacity-40">
            Después
          </button>
          {nuevo && (
            <button onClick={() => enviar(true)} disabled={enviando || debe <= 0}
              title="Registrar lo que se le debe, sin pagarle todavía"
              className="px-3 py-2 rounded-xl text-sm bg-white/8 hover:bg-white/12 text-white/80 cursor-pointer disabled:opacity-40">
              Dejar pendiente
            </button>
          )}
          <button onClick={() => enviar()} disabled={enviando || !valido}
            className="flex items-center gap-2 bg-lgb-red hover:bg-lgb-red/85 text-white px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-40">
            {enviando && <Loader2 size={14} className="animate-spin" />}
            {modo === "todo" ? "Ya le pagué" : `Registrar ${monto > 0 ? peso(monto) : "abono"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
