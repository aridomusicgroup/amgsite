"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check, Lock, Trash2 } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { toast } from "@/lib/toast";

/**
 * "Tu perfil": nombre, foto y contraseña de quien está usando el panel.
 *
 * La contraseña se cambia hablando DIRECTO con Supabase desde el navegador
 * (`updateUser`), igual que hace `/admin/auth/set-password`. No pasa por una
 * ruta nuestra a propósito: mandarla a un endpoint de Vercel la expondría en
 * registros y trazas sin ganar nada.
 */

/** Las iniciales sirven de foto mientras no haya una. */
function iniciales(nombre: string | null, email: string): string {
  const base = (nombre || "").trim() || email.split("@")[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || base[0].toUpperCase();
}

/**
 * Recorta al cuadrado y encoge a 256px ANTES de subir.
 *
 * Sin esto, una foto de celular de 4 MB viajaría entera para terminar
 * mostrándose a 40px. Así son ~30 KB y la subida es instantánea aunque sea con
 * datos móviles. WebP si el navegador puede; JPEG de respaldo (Safari viejo).
 */
async function prepararFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = 256;
  lienzo.height = 256;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise<Blob>((res, rej) =>
    lienzo.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen."))), "image/jpeg", 0.85),
  );
}

export function PerfilSection({ email, nombre: nombreInicial, fotoUrl }: {
  email: string;
  nombre: string | null;
  fotoUrl: string | null;
}) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(nombreInicial ?? "");
  const [foto, setFoto] = useState(fotoUrl);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (form: FormData) => {
    const r = await fetch("/api/admin/perfil", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return null; }
    router.refresh();
    return d;
  };

  const guardarNombre = async () => {
    setGuardando(true);
    const form = new FormData();
    form.set("nombre", nombre);
    if (await enviar(form)) toast("✓ Nombre guardado");
    setGuardando(false);
  };

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return;
    setSubiendo(true);
    try {
      const blob = await prepararFoto(f);
      const form = new FormData();
      form.set("foto", new File([blob], "perfil", { type: blob.type }));
      const d = await enviar(form);
      if (d?.foto_url) { setFoto(d.foto_url); toast("✓ Foto actualizada"); }
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo subir la foto"}`);
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  };

  const quitarFoto = async () => {
    setSubiendo(true);
    const form = new FormData();
    form.set("quitar_foto", "1");
    if (await enviar(form)) { setFoto(null); toast("✓ Foto quitada"); }
    setSubiendo(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Foto + nombre */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative shrink-0">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-lgb-red/15 border border-white/10 flex items-center justify-center text-lgb-red text-xl font-medium">
              {iniciales(nombre, email)}
            </div>
          )}
          <button
            onClick={() => archivo.current?.click()}
            disabled={subiendo}
            title="Cambiar foto"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-lgb-red text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </button>
          <input
            ref={archivo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => elegirFoto(e.target.files?.[0])}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-white/50 mb-1">Tu nombre</label>
          <div className="flex gap-2">
            <input
              value={nombre}
              maxLength={60}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); }}
              placeholder="Como quieres que te vean"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red"
            />
            <button
              onClick={guardarNombre}
              disabled={guardando || nombre === (nombreInicial ?? "")}
              className="flex items-center gap-1.5 bg-lgb-red text-white px-3 rounded-lg text-sm hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
            </button>
          </div>
          <p className="text-white/25 text-[11px] mt-1.5">
            Aparece en el menú y en la bitácora de actividad, en vez de tu correo.
          </p>
          {foto && (
            <button onClick={quitarFoto} disabled={subiendo} className="text-white/30 hover:text-red-300 text-[11px] mt-1.5 flex items-center gap-1 cursor-pointer">
              <Trash2 size={11} /> Quitar foto
            </button>
          )}
        </div>
      </div>

      {/* Correo — solo lectura */}
      <div>
        <label className="block text-xs text-white/50 mb-1">Tu correo</label>
        <div className="bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/40">{email}</div>
        <p className="text-white/25 text-[11px] mt-1.5">
          Es con el que entras al panel. Solo un administrador puede cambiarlo.
        </p>
      </div>

      <CambiarContrasena email={email} />
    </div>
  );
}

/**
 * Cambio de contraseña sin salir del panel.
 *
 * Pide la contraseña ACTUAL antes, verificándola con `signInWithPassword`.
 * Supabase no lo exige, pero sin eso una laptop abierta y desatendida se
 * convierte en un secuestro permanente de la cuenta.
 */
function CambiarContrasena({ email }: { email: string }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red";

  const guardar = async () => {
    setError("");
    if (nueva.length < 8) { setError("La contraseña nueva debe tener al menos 8 caracteres."); return; }
    if (nueva !== repetir) { setError("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true);
    try {
      const supabase = createAuthClient();
      const { error: eActual } = await supabase.auth.signInWithPassword({ email, password: actual });
      if (eActual) { setError("La contraseña actual no es correcta."); setBusy(false); return; }
      const { error: eNueva } = await supabase.auth.updateUser({ password: nueva });
      if (eNueva) { setError(eNueva.message); setBusy(false); return; }
      toast("✓ Contraseña actualizada");
      setAbierto(false);
      setActual(""); setNueva(""); setRepetir("");
    } finally {
      setBusy(false);
    }
  };

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors w-fit cursor-pointer"
      >
        <Lock size={14} /> Cambiar mi contraseña
      </button>
    );
  }

  return (
    <div className="border border-white/10 rounded-xl p-4 flex flex-col gap-2.5">
      <p className="text-sm flex items-center gap-2"><Lock size={14} /> Cambiar contraseña</p>
      <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Contraseña actual" className={inp} />
      <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva (mínimo 8 caracteres)" className={inp} />
      <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repite la nueva" className={inp} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={busy || !actual || !nueva} className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 cursor-pointer">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
        </button>
        <button onClick={() => { setAbierto(false); setError(""); }} className="text-white/50 hover:text-white text-sm px-3 cursor-pointer">Cancelar</button>
      </div>
      <p className="text-white/25 text-[11px]">
        Si no la recuerdas, sal del panel y usa &ldquo;Crear / olvidé mi contraseña&rdquo; en el login.
      </p>
    </div>
  );
}
