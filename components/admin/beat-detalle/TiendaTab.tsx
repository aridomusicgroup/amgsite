"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  LICENCIAS, PRECIO_MAX, avisosDePrecios, exclusivaEsDirecta, preciosEfectivos,
  type ExclusivaModo, type LicenciaId,
} from "@/lib/beat-ficha";
import type { BeatDetalleAdmin } from "@/lib/beat-admin";
import { guardarFicha, inp, Interruptor, Seccion } from "./comun";

const NOMBRE: Record<LicenciaId, { nombre: string; archivos: string }> = {
  basic: { nombre: "Basic", archivos: "MP3" },
  premium: { nombre: "Premium", archivos: "MP3 + WAV" },
  "premium-plus": { nombre: "Premium Plus", archivos: "MP3 + WAV + STEMS" },
  exclusive: { nombre: "Exclusiva", archivos: "Todo + contrato; se retira de la venta" },
};

type Modo = "" | ExclusivaModo;

/**
 * Tienda: si el beat se ve, si va primero, y cuánto cuesta cada licencia.
 * El precio global sale de licenses.json; aquí sólo se pone el AJUSTE de este
 * beat. Campo vacío = el global.
 */
export function TiendaTab({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cambiar = async (campo: "oculto" | "destacado", valor: boolean) => {
    setOcupado(campo);
    const err = await guardarFicha(d.id, { [campo]: valor });
    setOcupado(null);
    if (err) { toast(`⚠️ ${err}`); return; }
    toast(campo === "oculto"
      ? valor ? "Beat oculto: ya no aparece en la tienda ni se puede comprar" : "✓ El beat volvió a la tienda"
      : valor ? "⭐ Destacado: sale primero en la tienda" : "Ya no está destacado");
    router.refresh();
  };

  const bloqueado = !d.tablaFicha;

  return (
    <div className="space-y-4">
      <Seccion titulo="Visibilidad" nota="Ocultar lo quita de la tienda, del chatbot y del checkout. No borra nada: se puede volver a mostrar cuando quieras.">
        <div className="divide-y divide-white/8">
          <Interruptor
            activo={!d.beat.oculto}
            deshabilitado={bloqueado || ocupado !== null}
            onCambio={(v) => cambiar("oculto", !v)}
            etiqueta={d.beat.oculto ? "Oculto de la tienda" : "Visible en la tienda"}
            detalle={d.beat.oculto ? "Nadie lo ve ni lo puede comprar." : "Se ve, suena y se puede comprar."}
          />
          <Interruptor
            activo={d.beat.destacado}
            deshabilitado={bloqueado || ocupado !== null}
            onCambio={(v) => cambiar("destacado", v)}
            etiqueta="Destacado"
            detalle="Sale arriba de todo en el orden normal de la tienda."
          />
        </div>
      </Seccion>

      <Precios d={d} key={d.ficha.updated_at ?? "nuevo"} />
    </div>
  );
}

function Precios({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const inicialAjuste = useMemo(() => {
    const out = {} as Record<LicenciaId, string>;
    for (const id of LICENCIAS) out[id] = d.ficha.precios?.[id] != null ? String(d.ficha.precios[id]) : "";
    return out;
  }, [d.ficha.precios]);
  const [ajuste, setAjuste] = useState(inicialAjuste);
  const [modo, setModo] = useState<Modo>(d.ficha.exclusiva_modo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Legacy = su exclusiva se negocia por defecto (la regla de siempre).
  const esLegacy = d.preciosBase.exclusive === null;
  const numero = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const vista = preciosEfectivos({
    globales: d.preciosBase,
    ajuste: Object.fromEntries(LICENCIAS.map((id) => [id, numero(ajuste[id])]).filter(([, v]) => v !== undefined && Number.isFinite(v))),
    modo: modo || null,
    esLegacy,
    exclusivaDirecta: d.exclusivaDirectaGlobal,
  });
  const directa = exclusivaEsDirecta(modo || null, esLegacy);
  const avisos = avisosDePrecios(vista);

  const hayCambios = LICENCIAS.some((id) => ajuste[id].trim() !== inicialAjuste[id].trim()) || modo !== (d.ficha.exclusiva_modo ?? "");

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const precios: Record<string, number | null> = {};
    for (const id of LICENCIAS) precios[id] = numero(ajuste[id]) ?? null;
    const err = await guardarFicha(d.id, { precios, exclusiva_modo: modo || null });
    setGuardando(false);
    if (err) { setError(err); return; }
    toast("✓ Precios guardados");
    router.refresh();
  };

  const bloqueado = !d.tablaFicha;
  const reglaDeSiempre = esLegacy ? "negociar, beat de antes" : "compra directa";

  return (
    <Seccion
      titulo="Precios de este beat (USD)"
      nota="El número gris es el precio global. Escribe otro sólo si este beat debe costar distinto; vacío = el global."
    >
      {!d.directCheckout && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2.5 mb-4">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[12px] text-white/65 leading-relaxed">
            <span className="font-medium text-amber-300">Hoy Basic, Premium y Premium Plus se cobran en BeatStars</span> (el cobro directo del sitio
            está apagado): aquí sólo cambias lo que se <span className="font-medium text-white/85">muestra</span>. Si lo cambias, cámbialo también en BeatStars.
            La <span className="font-medium text-white/85">Exclusiva directa sí se cobra en el sitio</span> con este precio.
          </p>
        </div>
      )}

      <div className="divide-y divide-white/8">
        {LICENCIAS.map((id) => {
          const esEx = id === "exclusive";
          const global = esEx ? d.exclusivaDirectaGlobal : d.preciosBase[id];
          const inactivo = esEx && !directa;
          return (
            <div key={id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85">{NOMBRE[id].nombre}</p>
                <p className="text-[12px] text-white/40">{NOMBRE[id].archivos}</p>
              </div>
              {inactivo ? (
                <span className="text-[12px] text-white/45 w-28 text-right">Se negocia</span>
              ) : (
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35 text-sm">$</span>
                  <input
                    aria-label={`Precio ${NOMBRE[id].nombre}`}
                    value={ajuste[id]}
                    onChange={(e) => setAjuste((a) => ({ ...a, [id]: e.target.value.replace(/[^\d.]/g, "") }))}
                    inputMode="decimal"
                    placeholder={global != null ? String(global) : ""}
                    max={PRECIO_MAX}
                    disabled={bloqueado}
                    className={`${inp} pl-6 text-right tabular-nums ${ajuste[id] ? "border-white/25" : ""}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium text-white/55 mb-1.5">Exclusiva</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cómo se vende la exclusiva">
          {([
            ["", `Regla de siempre (${reglaDeSiempre})`],
            ["directa", "Compra directa en el sitio"],
            ["negociar", "Negociar por WhatsApp"],
          ] as [Modo, string][]).map(([v, texto]) => (
            <button key={v || "auto"} type="button" role="radio" aria-checked={modo === v} disabled={bloqueado}
              onClick={() => setModo(v)}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                modo === v ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white/80"}`}>
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5 text-[12px] text-white/60">
        Así se ve en la tienda: <span className="font-medium text-white/90">Desde ${vista.basic} USD</span>
        {" · "}Exclusiva: <span className="font-medium text-white/90">{vista.exclusive != null ? `$${vista.exclusive}` : "negociable"}</span>
      </div>

      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1">
          {avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-[12px] text-amber-300/90">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />{a} Revisa que la escalera tenga sentido.
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <button onClick={guardar} disabled={!hayCambios || guardando || bloqueado}
          className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer">
          {guardando && <Loader2 size={14} className="animate-spin" />}
          {guardando ? "Guardando…" : "Guardar precios"}
        </button>
        {hayCambios && !guardando && (
          <button onClick={() => { setAjuste(inicialAjuste); setModo(d.ficha.exclusiva_modo ?? ""); setError(null); }}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm cursor-pointer">
            <RotateCcw size={13} /> Deshacer
          </button>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </Seccion>
  );
}
