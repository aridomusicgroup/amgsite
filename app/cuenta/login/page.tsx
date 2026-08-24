"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, Lock, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

type Modo = "login" | "enlace";

export default function CuentaLogin() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error")
      ? "El enlace expiró o no es válido. Pide uno nuevo."
      : ""
  );

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/cuenta/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "No se pudo entrar."); return; }
      router.push("/cuenta");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const enviarEnlace = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    await fetch("/api/cuenta/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => {});
    setEnviado(true);
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-lgb-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logos/lgb-hero.png" alt="Latino Gang Beats" width={180} height={51} className="h-12 w-auto object-contain" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <h1 className="text-white font-coolvetica text-2xl mb-1">Mi Cuenta</h1>
          <p className="text-white/40 text-sm mb-6">
            Entra para ver tus beats, contratos y el avance de tus producciones.
          </p>

          {enviado ? (
            <div className="text-center py-4">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">Revisa tu correo</p>
              <p className="text-white/50 text-sm">
                Si <b className="text-white/70">{email}</b> tiene compras o contratos con nosotros, te enviamos un enlace para crear tu contraseña.
              </p>
              <button onClick={() => { setEnviado(false); setModo("login"); }} className="text-white/40 hover:text-white text-xs mt-5 cursor-pointer">
                ← Volver
              </button>
            </div>
          ) : modo === "login" ? (
            <form onSubmit={entrar} className="flex flex-col gap-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50"
                />
              </div>
              {error && <p className="text-lgb-red text-xs">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> Entrando…</> : "Entrar"}
              </button>
              <button type="button" onClick={() => { setModo("enlace"); setError(""); }} className="text-white/40 hover:text-white text-xs text-center mt-1 cursor-pointer">
                Primera vez o ¿olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={enviarEnlace} className="flex flex-col gap-3">
              <p className="text-white/50 text-xs mb-1">
                Te enviamos un enlace por correo para crear o restablecer tu contraseña.
              </p>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50"
                />
              </div>
              {error && <p className="text-lgb-red text-xs">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : "Enviarme el enlace"}
              </button>
              <button type="button" onClick={() => { setModo("login"); setError(""); }} className="text-white/40 hover:text-white text-xs text-center mt-1 cursor-pointer">
                ← Ya tengo contraseña
              </button>
            </form>
          )}
        </div>

        <a href="https://beats.aridomusicgroup.com" className="flex items-center justify-center gap-1.5 text-white/40 hover:text-white text-xs mt-6 transition-colors">
          <ArrowLeft size={12} /> Volver a la tienda
        </a>
      </div>
    </main>
  );
}
