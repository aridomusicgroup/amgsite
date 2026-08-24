"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, Loader2, ArrowLeft } from "lucide-react";

function ClaveForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (pw !== pw2) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/cuenta/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "No se pudo guardar."); return; }
      router.push("/cuenta");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-white/70 text-sm mb-4">El enlace no es válido o ya se usó.</p>
        <a href="/cuenta/login" className="text-lgb-red text-sm hover:underline">Pedir uno nuevo</a>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <div className="relative">
        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="password" required value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Nueva contraseña (mín. 8)"
          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50"
        />
      </div>
      <div className="relative">
        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)}
          placeholder="Repite la contraseña"
          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lgb-red/50"
        />
      </div>
      {error && <p className="text-lgb-red text-xs">{error}</p>}
      <button
        type="submit" disabled={busy}
        className="w-full bg-lgb-red text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
      >
        {busy ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : "Guardar y entrar"}
      </button>
    </form>
  );
}

export default function CuentaClave() {
  return (
    <main className="min-h-screen bg-lgb-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logos/lgb-hero.png" alt="Latino Gang Beats" width={180} height={51} className="h-12 w-auto object-contain" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <h1 className="text-white font-coolvetica text-2xl mb-1">Crea tu contraseña</h1>
          <p className="text-white/40 text-sm mb-6">Elige una contraseña para entrar a tu cuenta.</p>
          <Suspense fallback={<Loader2 size={20} className="animate-spin text-white/40 mx-auto" />}>
            <ClaveForm />
          </Suspense>
        </div>
        <a href="/cuenta/login" className="flex items-center justify-center gap-1.5 text-white/40 hover:text-white text-xs mt-6 transition-colors">
          <ArrowLeft size={12} /> Volver al inicio de sesión
        </a>
      </div>
    </main>
  );
}
