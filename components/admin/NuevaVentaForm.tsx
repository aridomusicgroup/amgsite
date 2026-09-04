"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { InstrumentosPicker } from "@/components/admin/InstrumentosPicker";
import { inferirInstrumentos } from "@/lib/servicios";
import { aMxn, esExtranjera, convertir, factorConversion, TIPO_CAMBIO_FALLBACK } from "@/lib/tipo-cambio";

const hoy = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  fecha: hoy(),
  cliente: "",
  email: "",
  telefono: "",
  canal: "whatsapp",
  tipo: "",
  beat_nombre: "",
  moneda: "MXN",
  monto_cobrado: "",
  tipo_cambio: "",
  total_mxn: "",
  estado_pago: "completo", // "completo" | "anticipo"
  anticipo: "",
  medio_pago: "",
  extras: "",
  canciones: "",
  quien_cerro: "",
  crear_proyecto: "si", // "si" | "" — crea proyecto de producción (off para beats de catálogo)
};

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

export function NuevaVentaForm({ beats, tcSugerido = TIPO_CAMBIO_FALLBACK }: {
  beats: { id: string; nombre: string }[];
  /** Promedio de las últimas ventas en dólares (lo calcula el servidor). */
  tcSugerido?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  /** Quién toca cada instrumento. Lo llena el propio InstrumentosPicker. */
  const [musicosElegidos, setMusicosElegidos] = useState<{ instrumento: string; musico_id: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  /**
   * Moneda, monto y tipo de cambio calculan el total en pesos solitos.
   *
   * El total sigue siendo editable a mano: BeatStars y PayPal a veces depositan
   * un peso más o un peso menos por redondeos, y quien captura tiene que poder
   * dejar el número que de verdad cayó en la cuenta.
   */
  const setConversion = (k: "moneda" | "monto_cobrado" | "tipo_cambio") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => {
        const n = { ...p, [k]: e.target.value };

        if (k === "moneda") {
          // Al pasar a dólares se propone el promedio si el campo está vacío.
          const tc = Number(p.tipo_cambio) > 0 ? Number(p.tipo_cambio) : tcSugerido;
          if (esExtranjera(n.moneda) && !(Number(n.tipo_cambio) > 0)) n.tipo_cambio = String(tcSugerido);
          // Y el monto se REEXPRESA en la nueva moneda: 6,000 pesos son ~359
          // dólares, no 6,000 dólares.
          const factor = factorConversion(p.moneda, n.moneda, tc);
          if (factor && Number(n.monto_cobrado) > 0) {
            n.monto_cobrado = String(convertir(Number(n.monto_cobrado), factor));
          }
        }

        const convertido = aMxn(Number(n.monto_cobrado) || 0, n.moneda, Number(n.tipo_cambio) || 0);
        if (convertido > 0) n.total_mxn = String(convertido);
        return n;
      });

  const totalNum = Number(f.total_mxn) || 0;
  const anticipoNum = Number(f.anticipo) || 0;
  const saldoPrev = Math.max(0, totalNum - anticipoNum);

  // Al cambiar a "anticipo", precarga el 50% del total si está vacío.
  const onEstado = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setF((p) => ({
      ...p,
      estado_pago: val,
      anticipo:
        val === "anticipo" && !p.anticipo && Number(p.total_mxn) > 0
          ? String(Math.round(Number(p.total_mxn) / 2))
          : val === "completo"
            ? ""
            : p.anticipo,
    }));
  };
  const set50 = () =>
    setF((p) => (p.total_mxn ? { ...p, anticipo: String(Math.round(Number(p.total_mxn) / 2)) } : p));

  // Precarga los instrumentos del paquete detectado (sin pisar lo que ya eligió).
  const inferir = (tipo: string, beat: string, actual: string) => {
    if (actual.trim()) return actual;
    const inf = inferirInstrumentos([tipo, beat]);
    return inf.length ? inf.join(", ") : actual;
  };

  // El tipo decide el default: servicio → crea proyecto; licencia/catálogo → no.
  const onTipo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((p) => ({
      ...p, tipo: v,
      crear_proyecto: /licenc|cat[aá]log/i.test(v) ? "" : "si",
      extras: inferir(v, p.beat_nombre, p.extras),
    }));
  };
  const onBeat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, beat_nombre: v, extras: inferir(p.tipo, v, p.extras) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const beatMatch = beats.find((b) => norm(b.nombre) === norm(f.beat_nombre));
      const r = await fetch("/api/admin/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          inventario_beat_id: beatMatch?.id ?? null,
          anticipo: f.estado_pago === "anticipo" ? f.anticipo : "",
          instrumentos: f.extras, // el selector alimenta las tareas "Grabar {instrumento}"
          // Quién toca cada uno: sin esto, un instrumento con dos candidatos
          // (tololoche, trombón) generaba un pago pendiente para cada uno.
          musicos_elegidos: musicosElegidos,
        }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo guardar.");
      else {
        const partes = [`✓ Venta ${d.folio} registrada`];
        if (d.saldo > 0) partes.push(`saldo por cobrar $${Math.round(d.saldo).toLocaleString("es-MX")}`);
        if (d.proyecto) partes.push(`proyecto ${d.proyecto} creado`);
        setOk(partes.join(" · "));
        setF({ ...EMPTY });
        router.refresh();
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const lbl = "block text-xs text-white/50 mb-1";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all mb-4"
      >
        <Plus size={16} /> Nueva venta
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
      <datalist id="tipos">
        <option value="Beat personalizado" />
        <option value="Licencia básica" />
        <option value="Exclusividad" />
        <option value="BP + LETRA" />
        <option value="Solo grabación" />
        <option value="EP" />
        <option value="Álbum" />
      </datalist>
      <datalist id="medios">
        <option value="ZELLE" /><option value="PAYPAL" /><option value="TRANSFERENCIA NACIONAL" />
        <option value="Efectivo" /><option value="Stripe" />
      </datalist>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-coolvetica text-lg">Nueva venta</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Fecha *</label>
          <input type="date" value={f.fecha} onChange={set("fecha")} required className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Cliente</label>
          <input value={f.cliente} onChange={set("cliente")} placeholder="Nombre" className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Email <span className="text-white/25">(clave en BeatStars)</span></label>
          <input type="email" value={f.email} onChange={set("email")} placeholder="cliente@correo.com" className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Teléfono <span className="text-white/25">(clave en WhatsApp)</span></label>
          <input type="tel" value={f.telefono} onChange={set("telefono")} placeholder="477 123 4567" className={inp} />
        </div>
        <div>
          <label className={lbl}>Canal</label>
          <select value={f.canal} onChange={set("canal")} className={inp}>
            <option value="whatsapp" className="bg-lgb-dark">WhatsApp</option>
            <option value="instagram" className="bg-lgb-dark">Instagram</option>
            <option value="beatstars" className="bg-lgb-dark">BeatStars</option>
            <option value="tiktok" className="bg-lgb-dark">TikTok</option>
            <option value="facebook" className="bg-lgb-dark">Facebook</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Tipo</label>
          <input list="tipos" value={f.tipo} onChange={onTipo} placeholder="Beat personalizado" className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Beat <span className="text-white/25">(del inventario o libre)</span></label>
          <input list="beats-inv" value={f.beat_nombre} onChange={onBeat} placeholder="CHANEL" className={inp} />
          <datalist id="beats-inv">
            {beats.map((b) => <option key={b.id} value={b.nombre} />)}
          </datalist>
        </div>
        <div>
          <label className={lbl}>Moneda</label>
          <select value={f.moneda} onChange={setConversion("moneda")} className={inp}>
            <option value="MXN" className="bg-lgb-dark">MXN</option>
            <option value="USD" className="bg-lgb-dark">USD</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Monto cobrado</label>
          <input type="number" step="any" value={f.monto_cobrado} onChange={setConversion("monto_cobrado")} placeholder="350" className={inp} />
        </div>
        <div>
          <label className={lbl}>
            Tipo de cambio {esExtranjera(f.moneda) && <span className="text-white/30">(prom. {tcSugerido})</span>}
          </label>
          <input type="number" step="any" value={f.tipo_cambio} onChange={setConversion("tipo_cambio")} placeholder={String(tcSugerido)} className={inp} />
        </div>
        <div>
          <label className={lbl}>
            Total MXN * {esExtranjera(f.moneda) && Number(f.tipo_cambio) > 0 && <span className="text-green-300/70">se calcula solo</span>}
          </label>
          <input type="number" step="any" value={f.total_mxn} onChange={set("total_mxn")} required placeholder="6000" className={inp} />
        </div>
        <div>
          <label className={lbl}>Estado del pago</label>
          <select value={f.estado_pago} onChange={onEstado} className={inp}>
            <option value="completo" className="bg-lgb-dark">Pagado completo</option>
            <option value="anticipo" className="bg-lgb-dark">Anticipo (parcial)</option>
          </select>
        </div>
        {f.estado_pago === "anticipo" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">Anticipo recibido</label>
              <button type="button" onClick={set50} className="text-[10px] text-lgb-red hover:underline">50%</button>
            </div>
            <input type="number" step="any" value={f.anticipo} onChange={set("anticipo")} placeholder="3000" className={inp} />
            <p className="text-amber-300/80 text-[10px] mt-1">
              Saldo por cobrar: <span className="font-medium">${saldoPrev.toLocaleString("es-MX")}</span>
            </p>
          </div>
        )}
        <div>
          <label className={lbl}>Medio de pago</label>
          <input list="medios" value={f.medio_pago} onChange={set("medio_pago")} placeholder="ZELLE" className={inp} />
        </div>
        <div>
          <label className={lbl}>Quién cerró</label>
          <input value={f.quien_cerro} onChange={set("quien_cerro")} placeholder="Eliud" className={inp} />
        </div>
        {f.crear_proyecto === "si" && (
          <div className="col-span-2 sm:col-span-3">
            <label className={lbl}>
              Instrumentos / músicos{" "}
              <span className="text-white/25">(se infieren del paquete; ajusta lo que necesites)</span>
            </label>
            <InstrumentosPicker value={f.extras} onChange={(v) => setF((p) => ({ ...p, extras: v }))} onMusicos={setMusicosElegidos} />
          </div>
        )}
        {/\bep\b|álbum|album/i.test(f.tipo) && (
          <div className="col-span-2 sm:col-span-3">
            <label className={lbl}>Canciones del EP/Álbum <span className="text-white/25">(una por línea → se vuelven tareas en Producción)</span></label>
            <textarea
              value={f.canciones}
              onChange={(e) => setF((p) => ({ ...p, canciones: e.target.value }))}
              rows={4}
              placeholder={"Intro\nLa vida que elegí\nSin miedo\n…"}
              className={inp}
            />
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 mt-4 cursor-pointer">
        <input
          type="checkbox"
          checked={f.crear_proyecto === "si"}
          onChange={(e) => setF((p) => ({ ...p, crear_proyecto: e.target.checked ? "si" : "" }))}
          className="accent-lgb-red w-4 h-4 mt-0.5 shrink-0"
        />
        <span className="text-sm text-white/70">
          Crear proyecto de producción
          <span className="block text-white/35 text-[11px]">
            Usa la misma plantilla que Producción: maqueta → “Grabar …” por instrumento → editar y cuantizar (con subtareas) → mezcla → master, ya con responsables. Apágalo si es un beat del catálogo.
          </span>
        </span>
      </label>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      {ok && <p className="text-green-400 text-sm mt-3">{ok}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 mt-4"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {saving ? "Guardando…" : "Guardar venta"}
      </button>
    </form>
  );
}
