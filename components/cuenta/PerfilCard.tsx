"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Loader2, Check, ChevronDown } from "lucide-react";

interface Props {
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  completo: boolean;
}

export function PerfilCard({ nombre, telefono, direccion, completo }: Props) {
  // Si aún faltan datos, se abre de una; si ya está completo, arranca colapsado.
  const [abierto, setAbierto] = useState(!completo);
  const [form, setForm] = useState({ nombre: nombre || "", telefono: telefono || "", direccion: direccion || "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setOk(false);
    try {
      const res = await fetch("/api/cuenta/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "No se pudo guardar."); return; }
      setOk(true);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-lgb-red/50";

  return (
    <section
      className={`rounded-2xl border p-5 ${completo ? "border-white/8 bg-white/[0.02]" : "border-lgb-red/30 bg-lgb-red/[0.06]"}`}
    >
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2.5 text-left cursor-pointer"
      >
        <UserRound size={18} className={completo ? "text-white/60" : "text-lgb-red"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {completo ? "Mis datos" : "Completa tus datos"}
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            {completo
              ? "Se usan para tus contratos. Toca para editar."
              : "Los usamos para generar tus contratos. Solo toma un momento."}
          </p>
        </div>
        <ChevronDown size={16} className={`text-white/40 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <form onSubmit={guardar} className="flex flex-col gap-3 mt-4">
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Nombre completo *</span>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Tu nombre" />
          </label>
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Dirección</span>
            <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={inputCls} placeholder="Calle, número, colonia, ciudad, C.P." />
          </label>
          <label className="block">
            <span className="block text-xs text-white/40 mb-1">Teléfono / WhatsApp</span>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputCls} placeholder="+52 …" />
          </label>
          {error && <p className="text-lgb-red text-xs">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="self-start flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            {busy ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : ok ? <><Check size={15} /> Guardado</> : "Guardar datos"}
          </button>
        </form>
      )}
    </section>
  );
}
