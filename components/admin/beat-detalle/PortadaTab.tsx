"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Music2, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { cuadradoWebp, medidas } from "@/lib/imagen-cliente";
import type { BeatDetalleAdmin } from "@/lib/beat-admin";
import { Pastilla, Seccion } from "./comun";

const MIN_LADO = 800;

function Imagen({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  if (!src) {
    return (
      <div className={`${className} bg-white/5 flex items-center justify-center`}>
        <Music2 size={20} className="text-white/25" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`${className} object-cover`} />;
}

/**
 * Portada: la que se ve en la tarjeta de la tienda, en la página del beat, al
 * compartir el link por WhatsApp y en el pago de Stripe. Se recorta cuadrada y
 * se comprime en el navegador antes de subir.
 */
export function PortadaTab({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const propia = Boolean(d.ficha.portada_url);
  const grande = previa ?? d.beat.artworkLarge ?? d.beat.artworkUrl;
  const chica = previa ?? d.beat.artworkUrl ?? d.beat.artworkLarge;

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Usa una imagen JPG, PNG o WebP."); return; }
    setSubiendo(true);
    try {
      const { ancho, alto } = await medidas(file);
      if (Math.min(ancho, alto) < MIN_LADO) {
        const seguir = confirm(`La imagen mide ${ancho}×${alto}px. Se verá borrosa en la página del beat (lo ideal es 1200px o más). ¿Subirla de todos modos?`);
        if (!seguir) return;
      }
      const [g, c] = await Promise.all([cuadradoWebp(file, 1200, 0.86), cuadradoWebp(file, 400, 0.82)]);
      setPrevia(URL.createObjectURL(g));
      const form = new FormData();
      form.append("grande", new File([g], "1200", { type: g.type }));
      form.append("chica", new File([c], "400", { type: c.type }));
      const r = await fetch(`/api/admin/beats/${encodeURIComponent(d.id)}/portada`, { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "No se pudo subir."); setPrevia(null); return; }
      toast("✓ Portada nueva — ya se ve en la tienda");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la imagen.");
      setPrevia(null);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  const restablecer = async () => {
    if (!confirm("¿Volver a la portada original de BeatStars?")) return;
    setQuitando(true);
    try {
      const r = await fetch(`/api/admin/beats/${encodeURIComponent(d.id)}/portada`, { method: "DELETE" });
      if (!r.ok) { toast("⚠️ No se pudo restablecer."); return; }
      setPrevia(null);
      toast("Portada original restablecida");
      router.refresh();
    } finally {
      setQuitando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Seccion
        titulo="Portada"
        nota="Cuadrada, idealmente de 1200px o más. Se recorta al centro y se comprime sola."
        derecha={<Pastilla tono={propia ? "info" : "neutro"}>{propia ? "propia" : "de BeatStars"}</Pastilla>}
      >
        <div className="flex flex-col sm:flex-row gap-5">
          <Imagen src={grande} alt={`Portada de ${d.beat.title}`} className="w-full sm:w-56 aspect-square self-start shrink-0 rounded-xl border border-white/10" />
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="text-[11px] font-medium text-white/55 mb-2">Así se ve en la tienda</p>
              <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-2.5 max-w-xs">
                <Imagen src={chica} alt="" className="w-14 h-14 rounded-lg shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white/90 truncate">{d.beat.title}</p>
                  <p className="text-[12px] text-white/45">Desde ${d.beat.price} USD</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-white/55 mb-2">Al compartir el link (WhatsApp, Instagram)</p>
              <div className="rounded-xl border border-white/8 bg-black/20 overflow-hidden max-w-xs">
                <Imagen src={grande} alt="" className="w-full aspect-[1.91/1]" />
                <div className="px-3 py-2">
                  <p className="text-[12px] text-white/85 truncate">{d.beat.title} — Latino Gang Beats</p>
                  <p className="text-[11px] text-white/40">beats.aridomusicgroup.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
        {!d.tablaFicha && <p className="text-amber-300/90 text-[12px] mt-3">Falta correr supabase-beat-ficha.sql para poder cambiarla.</p>}

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => elegir(e.target.files?.[0])} aria-label="Elegir imagen de portada" />
          <button onClick={() => input.current?.click()} disabled={subiendo || !d.tablaFicha}
            className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer">
            {subiendo ? <Loader2 size={15} className="animate-spin" /> : <ImageUp size={15} />}
            {subiendo ? "Subiendo…" : propia ? "Cambiar portada" : "Subir portada propia"}
          </button>
          {propia && (
            <button onClick={restablecer} disabled={quitando}
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm disabled:opacity-50 cursor-pointer">
              <RotateCcw size={13} /> Volver a la de BeatStars
            </button>
          )}
        </div>
      </Seccion>
    </div>
  );
}
