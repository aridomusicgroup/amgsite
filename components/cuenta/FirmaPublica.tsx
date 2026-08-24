"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, ArrowDown, Check } from "lucide-react";
import { renderAcuerdo } from "@/lib/acuerdos/acuerdo-cliente";

/**
 * Firma pública de UN acuerdo, sin sesión — el token de la URL es la
 * autorización. Es la versión de un solo paso de `AcuerdoGate`: aquí nunca hay
 * una fila de varios acuerdos, porque el enlace nace ligado a una sola
 * familia (la del servicio que se cotizó).
 */
export function FirmaPublica({
  token,
  titulo,
  cuerpo,
  nombreSugerido,
}: {
  token: string;
  titulo: string;
  cuerpo: string;
  nombreSugerido: string;
}) {
  const [nombre, setNombre] = useState(nombreSugerido);
  const [acepto, setAcepto] = useState(false);
  const [leido, setLeido] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  const alScroll = () => {
    const el = cajaRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLeido(true);
  };

  const aceptar = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/firmar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, acepto: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "No se pudo guardar tu firma.");
        return;
      }
      setListo(true);
    } catch {
      setError("Error de conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const puede = leido && acepto && nombre.trim().length >= 3 && !busy;

  if (listo) {
    return (
      <main className="min-h-screen bg-lgb-black text-white flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/15 text-green-300 flex items-center justify-center mx-auto mb-4">
            <Check size={22} />
          </div>
          <h1 className="font-coolvetica text-2xl mb-2">Quedó firmado</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Gracias, {nombre.trim().split(" ")[0]}. Ya tenemos tu aceptación registrada. En cuanto llegue tu
            anticipo arrancamos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2.5 mb-1">
          <FileText size={18} className="text-lgb-red" />
          <h1 className="font-coolvetica text-2xl">Antes de tu anticipo</h1>
        </div>
        <p className="text-white/45 text-sm mb-5">
          Lee y acepta este acuerdo para arrancar tu proyecto. El precio y las fechas van en tu cotización.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-white/8">
            <h2 className="text-sm font-medium text-white/85 leading-snug">{titulo}</h2>
          </div>

          <div
            ref={cajaRef}
            onScroll={alScroll}
            className="max-h-[45vh] overflow-y-auto px-4 sm:px-5 py-4 text-[13px] leading-relaxed text-white/70 whitespace-pre-line"
          >
            {renderAcuerdo(cuerpo, nombre)}
          </div>

          {!leido && (
            <div className="flex items-center justify-center gap-1.5 border-t border-white/8 px-4 py-2 text-[11px] text-amber-300/80">
              <ArrowDown size={12} /> Desliza hasta el final para poder aceptar
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-white/45 text-[11px] mb-1.5">Tu nombre completo (firma)</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Como aparece en tu identificación"
              maxLength={120}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              disabled={!leido}
              className="mt-0.5 h-4 w-4 shrink-0 accent-lgb-red disabled:opacity-40 cursor-pointer"
            />
            <span className={`text-[13px] leading-snug ${leido ? "text-white/75" : "text-white/35"}`}>
              Leí y acepto el acuerdo.
            </span>
          </label>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={aceptar}
            disabled={!puede}
            className="w-full flex items-center justify-center gap-2 bg-lgb-red text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Acepto y firmo
          </button>

          <p className="text-white/25 text-[11px] text-center">
            Se guarda una copia de lo que aceptas, con la fecha. Si tienes dudas antes de firmar, escríbenos por
            WhatsApp.
          </p>
        </div>
      </div>
    </main>
  );
}
