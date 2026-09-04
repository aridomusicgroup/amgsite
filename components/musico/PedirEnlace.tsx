"use client";
import { useState } from "react";
import { Loader2, Send, Check } from "lucide-react";

/**
 * "Mándame otro enlace."
 *
 * El portal no tiene contraseña y el enlace dura una semana, así que sin esto
 * cada enlace vencido obliga al músico a escribirle al estudio.
 *
 * El mensaje de éxito es a propósito ambiguo ("si ese correo tiene portal…"):
 * el servidor tampoco distingue, y decir "ese correo no existe" convertiría
 * esta pantalla en una forma de averiguar con quién trabaja el estudio.
 */
export function PedirEnlace() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const pedir = async () => {
    if (!email.trim()) return;
    setEnviando(true);
    try {
      await fetch("/api/musico/enlace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setListo(true);
    } catch {
      setListo(true);
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <p className="flex items-start gap-2 text-sm text-green-300/90 mt-5 text-left">
        <Check size={15} className="shrink-0 mt-0.5" />
        Si ese correo tiene portal, ya va en camino. Revisa tu bandeja — y la de spam.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-xs text-white/35 mb-2">Pídelo tú mismo con el correo que le diste al estudio:</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") pedir(); }}
          placeholder="tucorreo@ejemplo.com"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red"
        />
        <button
          onClick={pedir}
          disabled={enviando || !email.trim()}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-3 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 shrink-0 cursor-pointer"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandar
        </button>
      </div>
    </div>
  );
}
