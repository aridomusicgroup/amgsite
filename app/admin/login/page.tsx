"use client";
import { useState } from "react";
import Image from "next/image";
import { Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";

type Mode = "password" | "magic";

export default function AdminLogin() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"magic" | "reset" | null>(null);
  const [error, setError] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error")
      ? "El enlace expiró o ya se usó. Intenta de nuevo."
      : ""
  );

  // Login con correo + contraseña
  const loginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setError("Correo o contraseña incorrectos. ¿Aún no tienes contraseña? Créala abajo.");
        setBusy(false);
      } else {
        window.location.href = "/admin";
      }
    } catch {
      setError("Algo salió mal. Intenta de nuevo.");
      setBusy(false);
    }
  };

  // Login con enlace mágico (respaldo)
  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/admin/auth/callback` },
      });
      if (error) setError(error.message);
      else setSent("magic");
    } catch {
      setError("Algo salió mal. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  // Crear / recuperar contraseña por correo
  const sendReset = async () => {
    if (!email.trim()) {
      setError("Escribe tu correo primero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/auth/set-password`,
      });
      if (error) setError(error.message);
      else setSent("reset");
    } catch {
      setError("Algo salió mal. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50 transition-colors";

  return (
    <main className="min-h-screen bg-lgb-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logos/arido-blanco.png" alt="Árido Music Group" width={140} height={56} className="h-14 w-auto object-contain" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <h1 className="text-white font-coolvetica text-2xl mb-1">Panel ARIDO</h1>
          <p className="text-white/40 text-sm mb-6">Acceso solo para el equipo.</p>

          {sent ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">Revisa tu correo</p>
              <p className="text-white/50 text-sm">
                {sent === "magic"
                  ? <>Te enviamos un enlace de acceso a <b className="text-white/70">{email}</b>. Ábrelo en este dispositivo.</>
                  : <>Te enviamos un enlace a <b className="text-white/70">{email}</b> para crear tu contraseña. Ábrelo y define tu clave.</>}
              </p>
              <button onClick={() => setSent(null)} className="text-lgb-red text-xs mt-5 hover:text-red-400">← Volver</button>
            </div>
          ) : mode === "password" ? (
            <form onSubmit={loginPassword} className="flex flex-col gap-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="username" className={inputCls} />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" autoComplete="current-password" className={inputCls} />
              </div>
              {error && <p className="text-lgb-red text-xs">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer">
                {busy ? <><Loader2 size={16} className="animate-spin" /> Entrando…</> : "Entrar"}
              </button>
              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={sendReset} disabled={busy} className="text-white/50 hover:text-white">
                  Crear / olvidé mi contraseña
                </button>
                <button type="button" onClick={() => { setMode("magic"); setError(""); }} className="text-white/50 hover:text-white">
                  Entrar con enlace →
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={sendMagic} className="flex flex-col gap-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className={inputCls} />
              </div>
              {error && <p className="text-lgb-red text-xs">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer">
                {busy ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : "Enviar enlace de acceso"}
              </button>
              <button type="button" onClick={() => { setMode("password"); setError(""); }} className="text-white/50 hover:text-white text-xs pt-1 self-end">
                ← Entrar con contraseña
              </button>
            </form>
          )}
        </div>
        <p className="text-white/20 text-xs text-center mt-6">Latino Gang Beats · Árido Music Group 🌵</p>
      </div>
    </main>
  );
}
