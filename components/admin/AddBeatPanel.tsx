"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Music2, Trash2, Plus, ExternalLink, AlertTriangle, VolumeX, Eye, ChevronRight, Star, Search } from "lucide-react";
import { AuditoriaEntrega } from "@/components/admin/AuditoriaEntrega";
import type { BeatListaAdmin } from "@/lib/beat-admin";

type CatalogItem = BeatListaAdmin;

type Filtro = "todos" | "tienda" | "ocultos" | "sin_audio" | "sin_entrega" | "sin_promo" | "destacados" | "precio";

const FILTROS: { id: Filtro; label: string; cumple: (b: CatalogItem) => boolean }[] = [
  { id: "todos", label: "Todos", cumple: () => true },
  { id: "tienda", label: "En la tienda", cumple: (b) => !b.oculto },
  { id: "ocultos", label: "Ocultos", cumple: (b) => b.oculto },
  { id: "sin_audio", label: "Sin audio", cumple: (b) => !b.audio },
  { id: "sin_entrega", label: "Sin entrega", cumple: (b) => b.entrega === "sin_carpeta" },
  { id: "sin_promo", label: "Sin promoción", cumple: (b) => b.publicaciones === 0 },
  { id: "destacados", label: "Destacados", cumple: (b) => b.destacado },
  { id: "precio", label: "Precio propio", cumple: (b) => b.precioPropio },
];

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const EMPTY = { link: "", bpm: "", key: "", genre: "", driveLink: "" };

export function AddBeatPanel() {
  const [list, setList] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tramAudio, setTramAudio] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Avisos de lo que se hace en la lista (ocultar, traer audio), junto a la lista. */
  const [avisoLista, setAvisoLista] = useState<{ ok: boolean; text: string } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const cumple = FILTROS.find((f) => f.id === filtro)?.cumple ?? (() => true);
    const q = sinAcentos(busqueda.trim());
    return list.filter((b) => cumple(b) && (!q || sinAcentos(b.title).includes(q) || b.id.toLowerCase().includes(q)));
  }, [list, filtro, busqueda]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/catalog");
      const d = await r.json();
      setList(d.beats || []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) setMsg({ ok: false, text: d.error || "No se pudo agregar." });
      else {
        // Avisar AQUÍ es lo que evita el problema: si se guardó mudo y nadie lo
        // nota, el beat se queda así y en la tienda el play manda a BeatStars.
        setMsg({
          ok: !d.sinAudio,
          text: d.sinAudio
            ? `⏳ Agregado: ${d.beat.title} — pero BeatStars aún no termina de convertir el audio. Dale al ícono de la bocina tachada en unos minutos para traerlo.`
            : `✓ Agregado: ${d.beat.title}`,
        });
        setForm(EMPTY);
        load();
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión." });
    } finally {
      setSaving(false);
    }
  };

  const del = async (b: CatalogItem) => {
    const pregunta = b.source === "original"
      ? `¿Ocultar "${b.title}" de la tienda? (se puede volver a mostrar)`
      : `¿Borrar "${b.title}" del catálogo? Se agregó desde el panel: para recuperarlo habría que volver a pegar su link.`;
    if (!confirm(pregunta)) return;
    setDeleting(b.id);
    try {
      const r = await fetch(`/api/admin/catalog?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setAvisoLista({ ok: false, text: d.error || "No se pudo quitar el beat." });
      } else if (b.source === "original") {
        setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, oculto: true } : x)));
      } else {
        setList((prev) => prev.filter((x) => x.id !== b.id));
      }
    } catch {
      setAvisoLista({ ok: false, text: "Error de conexión al quitar." });
    } finally {
      setDeleting(null);
    }
  };

  /** Volver a mostrar un beat oculto. */
  const mostrar = async (b: CatalogItem) => {
    setDeleting(b.id);
    try {
      const r = await fetch(`/api/admin/beats/${encodeURIComponent(b.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oculto: false }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAvisoLista({ ok: false, text: d.error || "No se pudo mostrar." }); return; }
      setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, oculto: false } : x)));
      setAvisoLista({ ok: true, text: `✓ ${b.title} volvió a la tienda.` });
    } catch {
      setAvisoLista({ ok: false, text: "Error de conexión." });
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Vuelve a pedirle el audio a BeatStars.
   *
   * BeatStars convierte el audio DESPUÉS de que subes el beat. Si lo agregas al
   * panel a los minutos, la API todavía no da `streamUrl` y el beat se guarda
   * mudo — para siempre, porque nada volvía a revisarlo. En la tienda el play
   * de un beat mudo abre BeatStars en vez de sonar.
   */
  const traerAudio = async (b: CatalogItem) => {
    setTramAudio(b.id);
    setAvisoLista(null);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, resync: true }),
      });
      const d = await r.json();
      if (!r.ok) { setAvisoLista({ ok: false, text: d.error || "No se pudo traer el audio." }); return; }
      setAvisoLista({ ok: d.audio, text: `${d.audio ? "✓" : "⏳"} ${d.mensaje}` });
      if (d.audio) setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, audio: true } : x)));
    } catch {
      setAvisoLista({ ok: false, text: "Error de conexión al traer el audio." });
    } finally {
      setTramAudio(null);
    }
  };

  const input =
    "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-coolvetica flex items-center gap-2 mb-1">
        <Music2 size={22} className="text-lgb-red" /> Beats
      </h1>
      <p className="text-white/40 text-sm mb-6">
        Pega el link de BeatStars y el sistema jala portada, audio y datos. Aparece en la tienda al instante (sin deploy).
      </p>

      {/* Formulario */}
      <form onSubmit={submit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3 mb-8">
        <div>
          <label className="block text-xs text-white/50 mb-1">Link de BeatStars *</label>
          <input
            value={form.link}
            onChange={set("link")}
            required
            placeholder="https://www.beatstars.com/beat/…  o  https://bsta.rs/…"
            className={input}
          />
        </div>
        <div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2 mb-2">
            <AlertTriangle size={14} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/60 leading-relaxed">
              <span className="font-medium text-amber-300">Escribe estos tres.</span> BeatStars ya no los manda por su API
              (el BPM llega vacío y la tonalidad ni existe). Si los dejas en blanco, el beat aparece
              como <span className="text-white/40">— BPM · —</span> en la tienda. Se pueden corregir
              después en la ficha del beat.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">BPM</label>
              <input value={form.bpm} onChange={set("bpm")} inputMode="numeric" placeholder="130" className={input} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Tonalidad</label>
              <input value={form.key} onChange={set("key")} placeholder="D#m" className={input} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Género</label>
              <input value={form.genre} onChange={set("genre")} placeholder="Latin" className={input} />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Carpeta de Drive (opcional)</label>
          <input
            value={form.driveLink}
            onChange={set("driveLink")}
            placeholder="https://drive.google.com/drive/folders/…"
            className={input}
          />
          <p className="text-white/25 text-[11px] mt-1">
            La carpeta general del beat. Las subcarpetas MP3/WAV/STEMS se detectarán automáticamente (próximamente).
          </p>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}

        <button
          type="submit"
          disabled={saving || !form.link.trim()}
          className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50"
        >
          <Plus size={16} />
          {saving ? "Agregando…" : "Agregar beat"}
        </button>
      </form>

      {/* Catálogo completo */}
      <div className="flex items-end gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-white/70">Catálogo completo ({list.length})</h2>
          <p className="text-white/40 text-[12px]">Toca un beat para abrir su ficha: precios, portada, entrega, promoción y ventas.</p>
        </div>
        <label className="relative ml-auto w-full sm:w-56">
          <span className="sr-only">Buscar beat</span>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red" />
        </label>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-3" aria-label="Filtrar beats">
        {FILTROS.map((f) => {
          const n = list.filter(f.cumple).length;
          if (f.id !== "todos" && n === 0 && filtro !== f.id) return null;
          return (
            <button key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                filtro === f.id ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white/80"}`}>
              {f.label} <span className="text-white/35 tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      {avisoLista && (
        <p className={`text-sm mb-3 ${avisoLista.ok ? "text-green-400" : "text-red-400"}`}>{avisoLista.text}</p>
      )}
      {loading ? (
        <p className="text-white/40 text-sm">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="text-white/35 text-sm">{list.length === 0 ? "No hay beats en el catálogo." : "Ningún beat con ese filtro."}</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((b) => (
            <li
              key={b.id}
              className={`flex items-center gap-1 bg-white/[0.03] border border-white/8 rounded-xl pr-1.5 transition-colors hover:bg-white/[0.06] ${b.oculto ? "opacity-60" : ""}`}
            >
              <Link href={`/admin/beats/${encodeURIComponent(b.id)}`}
                className="group flex items-center gap-3 min-w-0 flex-1 pl-3 py-2.5 focus-visible:outline-none">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                  {b.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.artworkUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 size={16} className="text-white/30" />
                  )}
                </div>

                {/* Foco de salud de ENTREGA: verde vendible / ámbar sin carpeta de Drive */}
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.entrega === "ok" ? "bg-green-500" : "bg-amber-400"}`}
                  title={b.entrega === "ok"
                    ? "Listo para vender: tiene carpeta de Drive con los archivos"
                    : "Se vende pero NO se entrega: falta la carpeta de Drive (el cliente pagaría sin recibir archivos)"}
                />

                <div className="min-w-0 flex-1">
                  {/* flex-wrap: en celular las píldoras bajan de renglón en vez de
                      dejar el título en tres letras. */}
                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                    <p className="text-sm font-medium truncate max-w-full group-hover:underline group-focus-visible:underline underline-offset-2">{b.title}</p>
                    {b.destacado && <Star size={12} className="text-amber-300 shrink-0" aria-label="destacado" />}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      b.source === "original" ? "bg-white/10 text-white/50" : "bg-blue-500/15 text-blue-300"}`}>
                      {b.source}
                    </span>
                    {b.oculto && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full flex-shrink-0 bg-white/10 text-white/60">oculto</span>
                    )}
                    {b.entrega === "sin_carpeta" && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full flex-shrink-0 bg-amber-400/15 text-amber-300 whitespace-nowrap">
                        sin entrega
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs truncate">
                    <span className={b.bpm ? "" : "text-amber-400/80"}>{b.bpm ? `${b.bpm} BPM` : "— BPM"}</span>
                    {" · "}
                    <span className={b.key ? "" : "text-amber-400/80"}>{b.key || "—"}</span>
                    {" · "}{b.genre} · desde ${Number(b.price)}
                    {b.precioPropio && <span className="text-blue-300/80"> (propio)</span>}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/25 group-hover:text-white/60 flex-shrink-0" />
              </Link>

              {!b.audio && b.source === "agregado" && (
                <button
                  onClick={() => traerAudio(b)}
                  disabled={tramAudio === b.id}
                  className="text-amber-400/80 hover:text-amber-400 flex-shrink-0 disabled:opacity-40 p-1.5 cursor-pointer"
                  title="Sin audio: el play manda a BeatStars. Clic para traerlo."
                >
                  <VolumeX size={15} className={tramAudio === b.id ? "animate-pulse" : ""} />
                </button>
              )}

              {b.beatstarsUrl && (
                <a
                  href={b.beatstarsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:block text-white/30 hover:text-white flex-shrink-0 p-1.5"
                  title="Ver en BeatStars"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              {b.oculto && b.source === "original" ? (
                <button
                  onClick={() => mostrar(b)}
                  disabled={deleting === b.id}
                  className="text-white/40 hover:text-green-300 flex-shrink-0 disabled:opacity-40 p-1.5 cursor-pointer"
                  title="Volver a mostrar en la tienda"
                >
                  <Eye size={15} />
                </button>
              ) : (
                <button
                  onClick={() => del(b)}
                  disabled={deleting === b.id}
                  className="text-white/30 hover:text-red-400 flex-shrink-0 disabled:opacity-40 p-1.5 cursor-pointer"
                  title={b.source === "original" ? "Ocultar de la tienda" : "Borrar del catálogo"}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AuditoriaEntrega />
    </div>
  );
}
