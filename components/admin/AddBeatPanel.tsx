"use client";
import { useState, useEffect } from "react";
import { Music2, Trash2, Plus, ExternalLink, FolderSync, Pencil, AlertTriangle, VolumeX } from "lucide-react";
import { AuditoriaEntrega } from "@/components/admin/AuditoriaEntrega";

interface CatalogItem {
  id: string;
  title: string;
  bpm: number;
  key: string | null;
  genre: string;
  price: number;
  artworkUrl: string | null;
  url: string;
  beatstarsUrl: string | null;
  source: "original" | "agregado";
  entrega: "ok" | "sin_carpeta";
  /** false = la tienda no puede reproducirlo y el play manda a BeatStars. */
  audio: boolean;
}

const EMPTY = { link: "", bpm: "", key: "", genre: "", driveLink: "" };

export function AddBeatPanel() {
  const [list, setList] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [tramAudio, setTramAudio] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Beat cuya ficha se está editando en línea (null = ninguno). */
  const [editando, setEditando] = useState<string | null>(null);
  const [savingFicha, setSavingFicha] = useState<string | null>(null);

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
    if (!confirm(`¿Quitar "${b.title}" del catálogo?`)) return;
    setDeleting(b.id);
    try {
      const r = await fetch(`/api/admin/catalog?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg({ ok: false, text: d.error || "No se pudo quitar el beat." });
      } else {
        setList((prev) => prev.filter((x) => x.id !== b.id));
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión al quitar." });
    } finally {
      setDeleting(null);
    }
  };

  // Reintenta resolver la carpeta de Drive del beat (auto por nombre, o con el
  // link que el usuario pegue). Deja el beat 100% entregable sin re-subirlo.
  const retryDrive = async (b: CatalogItem) => {
    const driveLink =
      prompt(
        `Carpeta de Drive de "${b.title}"\n\nPega el link de la carpeta (o deja vacío para buscarla por nombre):`,
        ""
      ) ?? "";
    setRetrying(b.id);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, driveLink: driveLink.trim() }),
      });
      const d = await r.json();
      if (!r.ok) setMsg({ ok: false, text: d.error || "No se pudo vincular la carpeta." });
      else {
        setMsg({
          ok: true,
          text: `✓ Carpeta vinculada${d.subcarpetas ? " (con subcarpetas MP3/WAV/STEMS)" : ""}. Ya se entrega solo.`,
        });
        setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, entrega: "ok" } : x)));
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión al vincular la carpeta." });
    } finally {
      setRetrying(null);
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
    setMsg(null);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, resync: true }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error || "No se pudo traer el audio." }); return; }
      setMsg({ ok: d.audio, text: `${d.audio ? "✓" : "⏳"} ${d.mensaje}` });
      if (d.audio) setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, audio: true } : x)));
    } catch {
      setMsg({ ok: false, text: "Error de conexión al traer el audio." });
    } finally {
      setTramAudio(null);
    }
  };

  /**
   * Guarda la ficha (BPM / tonalidad / género) de un beat ya agregado.
   *
   * BeatStars dejó de mandar estos datos por su API pública, así que se
   * capturan a mano — y antes, si se te olvidaba llenarlos al subir el beat, la
   * única salida era borrarlo y volverlo a agregar.
   */
  const guardarFicha = async (id: string, ficha: { bpm: string; key: string; genre: string }) => {
    setSavingFicha(id);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, bpm: ficha.bpm, key: ficha.key, genre: ficha.genre }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error || "No se pudo guardar." }); return; }
      setList((prev) => prev.map((x) => x.id === id
        ? { ...x, bpm: Number(ficha.bpm) || 0, key: ficha.key.trim() || null, genre: ficha.genre.trim() || x.genre }
        : x));
      setEditando(null);
      setMsg({ ok: true, text: "✓ Ficha actualizada." });
    } catch {
      setMsg({ ok: false, text: "Error de conexión al guardar." });
    } finally {
      setSavingFicha(null);
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
              <b className="text-amber-200">Escribe estos tres.</b> BeatStars ya no los manda por su API
              (el BPM llega vacío y la tonalidad ni existe). Si los dejas en blanco, el beat aparece
              como <span className="text-white/40">— BPM · —</span> en la tienda. Se pueden corregir
              después con el lapicito.
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
      <h2 className="text-sm font-medium text-white/60 mb-1">
        Catálogo completo ({list.length})
      </h2>
      <p className="text-white/35 text-[11px] mb-3 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> listo para vender
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> sin carpeta de Drive → vincúlala con el ícono <FolderSync size={12} className="inline" />
        </span>
      </p>
      {loading ? (
        <p className="text-white/40 text-sm">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="text-white/30 text-sm">No hay beats en el catálogo.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5"
            >
              {/* Portada */}
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                {b.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.artworkUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music2 size={16} className="text-white/30" />
                )}
              </div>

              {/* Foco de salud de ENTREGA: 🟢 vendible / 🟡 sin carpeta de Drive */}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  b.entrega === "ok" ? "bg-green-500" : "bg-amber-400"
                }`}
                title={
                  b.entrega === "ok"
                    ? "Listo para vender: tiene carpeta de Drive con los archivos"
                    : "Se vende pero NO se entrega: falta la carpeta de Drive (el cliente pagaría sin recibir archivos)"
                }
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      b.source === "original"
                        ? "bg-white/10 text-white/50"
                        : "bg-lgb-red/20 text-lgb-red"
                    }`}
                  >
                    {b.source === "original" ? "original" : "agregado"}
                  </span>
                  {b.entrega === "sin_carpeta" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 bg-amber-400/15 text-amber-400 whitespace-nowrap">
                      sin entrega
                    </span>
                  )}
                </div>
                {editando === b.id ? (
                  <FichaEditor
                    beat={b}
                    guardando={savingFicha === b.id}
                    onGuardar={(f) => guardarFicha(b.id, f)}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <p className="text-white/40 text-xs truncate">
                    <span className={b.bpm ? "" : "text-amber-400/70"}>{b.bpm ? `${b.bpm} BPM` : "— BPM"}</span>
                    {" · "}
                    <span className={b.key ? "" : "text-amber-400/70"}>{b.key || "—"}</span>
                    {" · "}{b.genre} · ${Number(b.price)}
                  </p>
                )}
              </div>

              {/* Los originales viven en el archivo del catálogo, no en la
                  base: no se pueden editar desde aquí. */}
              {b.source === "agregado" && editando !== b.id && (
                <button
                  onClick={() => setEditando(b.id)}
                  className={`flex-shrink-0 ${b.bpm && b.key ? "text-white/30 hover:text-white" : "text-amber-400/80 hover:text-amber-400"}`}
                  title={b.bpm && b.key ? "Editar BPM / tonalidad / género" : "Le falta BPM o tonalidad — clic para llenarlos"}
                >
                  <Pencil size={15} />
                </button>
              )}

              {!b.audio && b.source === "agregado" && (
                <button
                  onClick={() => traerAudio(b)}
                  disabled={tramAudio === b.id}
                  className="text-amber-400/80 hover:text-amber-400 flex-shrink-0 disabled:opacity-40"
                  title="Sin audio: el play manda a BeatStars. Clic para traerlo."
                >
                  <VolumeX size={15} className={tramAudio === b.id ? "animate-pulse" : ""} />
                </button>
              )}

              {b.entrega === "sin_carpeta" && b.source === "agregado" && (
                <button
                  onClick={() => retryDrive(b)}
                  disabled={retrying === b.id}
                  className="text-amber-400/80 hover:text-amber-400 flex-shrink-0 disabled:opacity-40"
                  title="Vincular / reintentar carpeta de Drive"
                >
                  <FolderSync size={15} className={retrying === b.id ? "animate-pulse" : ""} />
                </button>
              )}

              {b.beatstarsUrl && (
                <a
                  href={b.beatstarsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/30 hover:text-white flex-shrink-0"
                  title="Ver en BeatStars"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                onClick={() => del(b)}
                disabled={deleting === b.id}
                className="text-white/30 hover:text-red-400 flex-shrink-0 disabled:opacity-40"
                title="Quitar del catálogo"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AuditoriaEntrega />
    </div>
  );
}

/**
 * Edición en línea de la ficha de un beat: BPM, tonalidad y género.
 *
 * Va en su propio componente para que tenga su propio estado: si viviera en la
 * lista, cada tecla que escribes volvería a pintar los 55 renglones del
 * catálogo. Se guarda con Enter y se cancela con Escape.
 */
function FichaEditor({ beat, guardando, onGuardar, onCancelar }: {
  beat: CatalogItem;
  guardando: boolean;
  onGuardar: (f: { bpm: string; key: string; genre: string }) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({
    bpm: beat.bpm ? String(beat.bpm) : "",
    key: beat.key ?? "",
    genre: beat.genre ?? "",
  });
  const campo = "bg-white/5 border border-white/15 rounded-md px-1.5 py-1 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red min-w-0";

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onGuardar(f);
    if (e.key === "Escape") onCancelar();
  };

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap" onKeyDown={teclas}>
      <input autoFocus value={f.bpm} onChange={(e) => setF({ ...f, bpm: e.target.value })}
        inputMode="numeric" placeholder="130" className={`${campo} w-14`} title="BPM" />
      <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })}
        placeholder="D#m" className={`${campo} w-16`} title="Tonalidad" />
      <input value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })}
        placeholder="Latin" className={`${campo} w-20`} title="Género" />
      <button onClick={() => onGuardar(f)} disabled={guardando}
        className="bg-lgb-red text-white text-[11px] px-2 py-1 rounded-md hover:bg-red-700 disabled:opacity-50 cursor-pointer">
        {guardando ? "…" : "Guardar"}
      </button>
      <button onClick={onCancelar} className="text-white/40 hover:text-white text-[11px] px-1 cursor-pointer">
        Cancelar
      </button>
    </div>
  );
}
