"use client";
import { useState } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";

/**
 * “Avísame”: quien llega de un Reel y todavía no compra deja su correo. Se le
 * avisa antes de que cierre la preventa y cuando abra el curso. El campo
 * `website` va oculto: si un bot lo llena, el servidor lo ignora.
 */
export function AvisameForm({ cursoId, texto, className = "" }: { cursoId: string; texto: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/cursos/aviso", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curso_id: cursoId, email, website }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo guardar.");
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  if (ok) {
    return (
      <p className={`flex items-center gap-2 text-sm text-green-400 ${className}`}>
        <CheckCircle2 size={16} /> Listo, te avisamos a {email}.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className={className}>
      <p className="text-xs text-white/60 mb-2">{texto}</p>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`aviso-${cursoId}`}>Tu correo</label>
        <input id={`aviso-${cursoId}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com" autoComplete="email" maxLength={200}
          className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-lgb-red" />
        {/* Trampa para bots: invisible para personas. */}
        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 border border-white/25 text-white px-4 py-2.5 rounded-full text-sm hover:border-lgb-red hover:text-lgb-red transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Avísame
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </form>
  );
}
