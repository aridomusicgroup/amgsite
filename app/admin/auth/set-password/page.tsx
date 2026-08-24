"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function SetPassword() {
  const [ready, setReady] = useState<"checking" | "ok" | "nosession">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Al llegar del enlace del correo ya hay sesión de recuperación; la verificamos.
  useEffect(() => {
    const supabase = createAuthClient();
    supabase.auth.getUser().then(({ data }) => {
      setReady(data.user ? "ok" : "nosession");
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (pw !== pw2) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { setError(error.message); setBusy(false); return; }
      setDone(true);
      setTimeout(() => { window.location.href = "/admin"; }, 1200);
    } catch {
      setError("Algo salió mal. Intenta de nuevo.");
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
          <h1 className="text-white font-coolvetica text-2xl mb-1">Crea tu contraseña</h1>

          {ready === "checking" ? (
            <p className="text-white/40 text-sm py-6 text-center"><Loader2 size={18} className="animate-spin inline mr-2" /> Verificando…</p>
          ) : ready === "nosession" ? (
            <p className="text-white/50 text-sm py-4">
              Este enlace expiró o ya se usó. Vuelve al{" "}
              <a href="/admin/login" className="text-lgb-red hover:text-red-400">inicio de sesión</a>{" "}
              y pide uno nuevo con &ldquo;Crear / olvidé mi contraseña&rdquo;.
            </p>
          ) : done ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium">¡Contraseña guardada!</p>
              <p className="text-white/50 text-sm mt-1">Entrando al panel…</p>
            </div>
          ) : (
            <form onSubmit={save} className="flex flex-col gap-3">
              <p className="text-white/40 text-sm mb-2">Elige una contraseña para tu cuenta.</p>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" className={inputCls} />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" className={inputCls} />
              </div>
              {error && <p className="text-lgb-red text-xs">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer">
                {busy ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
