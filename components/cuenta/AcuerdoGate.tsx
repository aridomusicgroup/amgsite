"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, ArrowDown, Check } from "lucide-react";
import { renderAcuerdo, type Familia } from "@/lib/acuerdos/acuerdo-cliente";

export interface AcuerdoPendienteCliente {
  familia: Familia;
  label: string;
  titulo: string;
  cuerpo: string;
}

/**
 * Acuerdos que el cliente aún no firma: se muestran UNO A LA VEZ y no dejan
 * pasar hasta terminar la fila. Solo trae las familias que a este cliente le
 * tocan según lo que ya compró — quien solo tiene licencias de catálogo no ve
 * nada aquí, y quien tiene un beat personalizado Y una mezcla firma los dos,
 * uno tras otro.
 *
 * El botón de cada uno solo se habilita tras deslizar el texto hasta abajo: un
 * "acepto" que se puede dar sin haber podido leer las cláusulas no vale gran
 * cosa si algún día se discute.
 */
export function AcuerdoGate({
  pendientes,
  nombreSugerido,
}: {
  pendientes: AcuerdoPendienteCliente[];
  nombreSugerido: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState(nombreSugerido);
  const [acepto, setAcepto] = useState(false);
  const [leido, setLeido] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);

  const actual = pendientes[paso];
  const esUltimo = paso === pendientes.length - 1;

  const alScroll = () => {
    const el = cajaRef.current;
    if (!el) return;
    // Margen de 24px: en algunos navegadores el scroll no llega al píxel exacto.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLeido(true);
  };

  const aceptar = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/cuenta/acuerdo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familia: actual.familia, nombre, acepto: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "No se pudo guardar tu aceptación.");
        return;
      }
      if (esUltimo) {
        router.refresh();
        return;
      }
      setPaso((p) => p + 1);
      setAcepto(false);
      setLeido(false);
    } catch {
      setError("Error de conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const puede = leido && acepto && nombre.trim().length >= 3 && !busy;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2.5 mb-1">
          <FileText size={18} className="text-lgb-red" />
          <h1 className="font-coolvetica text-2xl">Antes de entrar</h1>
        </div>
        <p className="text-white/45 text-sm mb-2">
          Para usar tu panel necesitamos que leas y aceptes {pendientes.length > 1 ? "estos acuerdos" : "este acuerdo"}
          . El precio y las fechas de cada trabajo van en su propia cotización.
        </p>

        {pendientes.length > 1 && (
          <div className="flex items-center gap-1.5 mb-5">
            {pendientes.map((p, i) => (
              <div
                key={p.familia}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  i < paso
                    ? "border-green-500/30 text-green-300 bg-green-500/10"
                    : i === paso
                      ? "border-lgb-red/40 text-white bg-lgb-red/10"
                      : "border-white/10 text-white/35"
                }`}
              >
                {i < paso && <Check size={11} />}
                {p.label}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-white/8">
            <h2 className="text-sm font-medium text-white/85 leading-snug">{actual.titulo}</h2>
          </div>

          <div
            key={actual.familia}
            ref={cajaRef}
            onScroll={alScroll}
            className="max-h-[45vh] overflow-y-auto px-4 sm:px-5 py-4 text-[13px] leading-relaxed text-white/70 whitespace-pre-line"
          >
            {renderAcuerdo(actual.cuerpo, nombre)}
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
              Leí y acepto el acuerdo de {actual.label.toLowerCase()}.
            </span>
          </label>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={aceptar}
            disabled={!puede}
            className="w-full flex items-center justify-center gap-2 bg-lgb-red text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {esUltimo ? "Acepto y entrar a mi panel" : "Acepto — siguiente acuerdo"}
          </button>

          <p className="text-white/25 text-[11px] text-center">
            Se guarda una copia de lo que aceptas, con la fecha. Si tienes dudas antes de firmar,
            escríbenos por WhatsApp.
          </p>
        </div>
      </div>
    </main>
  );
}
