"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, Video, FileText, Link2, Users, Save, Eye, EyeOff, Pencil, X } from "lucide-react";
import type { CursoDetalle, CursoModulo, CursoLeccion } from "@/lib/cursos-admin";

interface Props {
  curso: CursoDetalle;
  servicioEmail: string | null;
}

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

const TIPO_ICON = { video: Video, pdf: FileText, link: Link2 };

export function CursoEditor({ curso, servicioEmail }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-8">
      <CabeceraCurso curso={curso} servicioEmail={servicioEmail} onSaved={refresh} />

      <section>
        <h2 className="font-coolvetica text-xl mb-3">Contenido</h2>
        <div className="flex flex-col gap-4">
          {curso.modulos.map((m, i) => (
            <ModuloCard key={m.id} modulo={m} cursoId={curso.id} esPrimero={i === 0} esUltimo={i === curso.modulos.length - 1} onChanged={refresh} />
          ))}
        </div>
        <NuevoModulo cursoId={curso.id} onCreated={refresh} />
      </section>

      <AccesosSection curso={curso} onChanged={refresh} />
    </div>
  );
}

// ── Cabecera: datos del curso ──
function CabeceraCurso({ curso, servicioEmail, onSaved }: { curso: CursoDetalle; servicioEmail: string | null; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [descripcion, setDescripcion] = useState(curso.descripcion ?? "");
  const [precio, setPrecio] = useState(curso.precioMxn?.toString() ?? "");
  const [driveFolder, setDriveFolder] = useState(curso.driveFolderId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = titulo !== curso.titulo || descripcion !== (curso.descripcion ?? "")
    || precio !== (curso.precioMxn?.toString() ?? "") || driveFolder !== (curso.driveFolderId ?? "");

  const guardar = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos", "PATCH", {
        id: curso.id, titulo, descripcion: descripcion || null,
        precio_mxn: precio || null, drive_folder: driveFolder || null,
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setBusy(false); }
  };

  const toggleActivo = async () => {
    await api("/api/admin/cursos", "PATCH", { id: curso.id, activo: !curso.activo });
    onSaved();
  };

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-white/40 text-xs">/{curso.slug}</p>
        <button onClick={toggleActivo}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${curso.activo ? "bg-green-500/15 text-green-400" : "bg-white/10 text-white/50"}`}>
          {curso.activo ? <Eye size={13} /> : <EyeOff size={13} />}
          {curso.activo ? "Visible a clientes" : "Oculto"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-xs text-white/50 mb-1">Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs text-white/50 mb-1">Descripción</span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red resize-none" />
        </label>
        <label className="block">
          <span className="block text-xs text-white/50 mb-1">Precio MXN</span>
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" min="0"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
        </label>
        <label className="block">
          <span className="block text-xs text-white/50 mb-1">Carpeta de Drive (link o ID)</span>
          <input value={driveFolder} onChange={(e) => setDriveFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
        </label>
      </div>

      {servicioEmail && (
        <p className="mt-3 text-[11px] text-white/35 leading-relaxed">
          Para que los videos/PDFs se puedan reproducir, comparte la carpeta de Drive de este curso (viewer) con{" "}
          <code className="text-white/60">{servicioEmail}</code> — igual que las carpetas de beats.
        </p>
      )}

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button onClick={guardar} disabled={!dirty || busy}
        className="mt-4 flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 cursor-pointer">
        <Save size={15} /> {busy ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}

// ── Un módulo con sus lecciones ──
function ModuloCard({ modulo, cursoId, esPrimero, esUltimo, onChanged }: {
  modulo: CursoModulo; cursoId: string; esPrimero: boolean; esUltimo: boolean; onChanged: () => void;
}) {
  const [titulo, setTitulo] = useState(modulo.titulo);
  const [agregando, setAgregando] = useState(false);

  const guardarTitulo = async () => {
    const v = titulo.trim();
    if (!v || v === modulo.titulo) { setTitulo(modulo.titulo); return; }
    await api("/api/admin/cursos/modulos", "PATCH", { id: modulo.id, titulo: v });
    onChanged();
  };

  const borrar = async () => {
    if (!confirm(`¿Borrar el módulo "${modulo.titulo}" y todas sus lecciones?`)) return;
    await api("/api/admin/cursos/modulos", "DELETE", { id: modulo.id });
    onChanged();
  };

  const mover = async (dir: -1 | 1) => {
    // Pide el orden actual al padre vía cursoId+DOM no es trivial aquí: usamos
    // orden relativo del propio módulo — el padre re-consulta al refrescar.
    await api("/api/admin/cursos/modulos", "PATCH", { orden_ids: reordenarLocal(modulo.id, dir) });
    onChanged();
  };

  // El reordenado real de módulos se resuelve mandando el array completo de
  // ids visibles en la página — más simple que llevar estado propio aquí.
  const reordenarLocal = (id: string, dir: -1 | 1) => {
    const nodos = Array.from(document.querySelectorAll<HTMLElement>("[data-modulo-id]"));
    const ids = nodos.map((n) => n.dataset.moduloId as string);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return ids;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return ids;
  };

  return (
    <div data-modulo-id={modulo.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex flex-col shrink-0">
          <button onClick={() => mover(-1)} disabled={esPrimero} className="text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronUp size={14} /></button>
          <button onClick={() => mover(1)} disabled={esUltimo} className="text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronDown size={14} /></button>
        </div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="flex-1 min-w-0 bg-transparent font-coolvetica text-lg focus:outline-none border-b border-transparent focus:border-white/20" />
        <button onClick={borrar} className="text-white/25 hover:text-red-400 transition-colors cursor-pointer shrink-0"><Trash2 size={15} /></button>
      </div>

      <div className="flex flex-col gap-1.5 pl-6">
        {modulo.lecciones.map((l, i) => (
          <LeccionRow key={l.id} leccion={l} esPrimero={i === 0} esUltimo={i === modulo.lecciones.length - 1} onChanged={onChanged} />
        ))}
      </div>

      {agregando ? (
        <NuevaLeccion moduloId={modulo.id} onCreated={() => { setAgregando(false); onChanged(); }} onCancel={() => setAgregando(false)} />
      ) : (
        <button onClick={() => setAgregando(true)}
          className="mt-2 ml-6 flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors cursor-pointer">
          <Plus size={13} /> Agregar lección
        </button>
      )}
    </div>
  );
}

function LeccionRow({ leccion, esPrimero, esUltimo, onChanged }: {
  leccion: CursoLeccion; esPrimero: boolean; esUltimo: boolean; onChanged: () => void;
}) {
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [editando, setEditando] = useState(false);
  const Icon = TIPO_ICON[leccion.tipo];

  const guardarTitulo = async () => {
    const v = titulo.trim();
    if (!v || v === leccion.titulo) { setTitulo(leccion.titulo); return; }
    await api("/api/admin/cursos/lecciones", "PATCH", { id: leccion.id, titulo: v });
    onChanged();
  };

  const borrar = async () => {
    if (!confirm(`¿Borrar la lección "${leccion.titulo}"?`)) return;
    await api("/api/admin/cursos/lecciones", "DELETE", { id: leccion.id });
    onChanged();
  };

  const mover = async (dir: -1 | 1) => {
    // El contenedor del módulo acota la búsqueda a sus propias lecciones.
    const contenedor = document.querySelector(`[data-leccion-id="${leccion.id}"]`)?.parentElement;
    if (!contenedor) return;
    const ids = Array.from(contenedor.querySelectorAll<HTMLElement>("[data-leccion-id]")).map((n) => n.dataset.leccionId as string);
    const i = ids.indexOf(leccion.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api("/api/admin/cursos/lecciones", "PATCH", { orden_ids: ids });
    onChanged();
  };

  if (editando) {
    return (
      <EditarLeccion leccion={leccion} onSaved={() => { setEditando(false); onChanged(); }} onCancel={() => setEditando(false)} />
    );
  }

  return (
    <div data-leccion-id={leccion.id} className="flex items-center gap-2 py-1">
      <div className="flex flex-col shrink-0">
        <button onClick={() => mover(-1)} disabled={esPrimero} className="text-white/25 hover:text-white disabled:opacity-15 cursor-pointer"><ChevronUp size={11} /></button>
        <button onClick={() => mover(1)} disabled={esUltimo} className="text-white/25 hover:text-white disabled:opacity-15 cursor-pointer"><ChevronDown size={11} /></button>
      </div>
      <Icon size={14} className="text-white/40 shrink-0" />
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="flex-1 min-w-0 bg-transparent text-sm text-white/80 focus:outline-none border-b border-transparent focus:border-white/20" />
      {!leccion.driveFileId && !leccion.urlExterna && (
        <span className="text-amber-400/70 text-[10px] shrink-0">sin archivo</span>
      )}
      <button onClick={() => setEditando(true)} className="text-white/20 hover:text-white transition-colors cursor-pointer shrink-0"><Pencil size={13} /></button>
      <button onClick={borrar} className="text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0"><Trash2 size={13} /></button>
    </div>
  );
}

function EditarLeccion({ leccion, onSaved, onCancel }: { leccion: CursoLeccion; onSaved: () => void; onCancel: () => void }) {
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [tipo, setTipo] = useState(leccion.tipo);
  const [driveLink, setDriveLink] = useState(leccion.driveFileId ?? "");
  const [urlExterna, setUrlExterna] = useState(leccion.urlExterna ?? "");
  const [duracion, setDuracion] = useState(leccion.duracionSeg?.toString() ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { setErr("Ponle un título."); return; }
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos/lecciones", "PATCH", {
        id: leccion.id, titulo, tipo,
        drive_link: tipo !== "link" ? driveLink || null : null,
        url_externa: tipo === "link" ? urlExterna || null : null,
        duracion_seg: duracion || null,
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al guardar"); setBusy(false); }
  };

  return (
    <div className="my-1 rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
        <button onClick={onCancel} className="text-white/40 hover:text-white cursor-pointer shrink-0"><X size={16} /></button>
      </div>
      <div className="flex gap-2">
        {(["video", "pdf", "link"] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t)}
            className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${tipo === t ? "bg-lgb-red text-white" : "bg-white/5 text-white/50"}`}>
            {t}
          </button>
        ))}
      </div>
      {tipo !== "link" ? (
        <input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="Link de Drive (o ID) del archivo"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      ) : (
        <input value={urlExterna} onChange={(e) => setUrlExterna(e.target.value)} placeholder="URL externa"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      )}
      <input value={duracion} onChange={(e) => setDuracion(e.target.value)} type="number" min="0" placeholder="Duración en segundos (opcional)"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={busy} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancel} className="text-white/40 hover:text-white text-xs px-3 py-1.5 cursor-pointer">Cancelar</button>
      </div>
    </div>
  );
}

function NuevaLeccion({ moduloId, onCreated, onCancel }: { moduloId: string; onCreated: () => void; onCancel: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"video" | "pdf" | "link">("video");
  const [driveLink, setDriveLink] = useState("");
  const [urlExterna, setUrlExterna] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const crear = async () => {
    if (!titulo.trim()) { setErr("Ponle un título."); return; }
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos/lecciones", "POST", {
        modulo_id: moduloId, titulo, tipo,
        drive_link: tipo !== "link" ? driveLink || null : null,
        url_externa: tipo === "link" ? urlExterna || null : null,
      });
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al crear"); setBusy(false); }
  };

  return (
    <div className="mt-2 ml-6 rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la lección" autoFocus
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      <div className="flex gap-2">
        {(["video", "pdf", "link"] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t)}
            className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${tipo === t ? "bg-lgb-red text-white" : "bg-white/5 text-white/50"}`}>
            {t}
          </button>
        ))}
      </div>
      {tipo !== "link" ? (
        <input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="Link de Drive (o ID) del archivo"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      ) : (
        <input value={urlExterna} onChange={(e) => setUrlExterna(e.target.value)} placeholder="URL externa"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-lgb-red" />
      )}
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button onClick={crear} disabled={busy} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? "Creando…" : "Agregar"}
        </button>
        <button onClick={onCancel} className="text-white/40 hover:text-white text-xs px-3 py-1.5 cursor-pointer">Cancelar</button>
      </div>
    </div>
  );
}

function NuevoModulo({ cursoId, onCreated }: { cursoId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [busy, setBusy] = useState(false);

  const crear = async () => {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      await api("/api/admin/cursos/modulos", "POST", { curso_id: cursoId, titulo });
      setTitulo("");
      onCreated();
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 flex gap-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre del módulo (ej. Mezcla básica)"
        onKeyDown={(e) => e.key === "Enter" && crear()}
        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
      <button onClick={crear} disabled={busy || !titulo.trim()}
        className="flex items-center gap-1.5 bg-white/10 text-white px-3.5 py-2 rounded-xl text-sm hover:bg-white/15 transition-colors disabled:opacity-40 cursor-pointer">
        <Plus size={15} /> Módulo
      </button>
    </div>
  );
}

// ── Quién tiene acceso ──
function AccesosSection({ curso, onChanged }: { curso: CursoDetalle; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dar = async () => {
    const v = email.trim().toLowerCase();
    if (!v) return;
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos/accesos", "POST", { curso_id: curso.id, email: v });
      setEmail("");
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al dar acceso"); }
    finally { setBusy(false); }
  };

  const revocar = async (id: string) => {
    if (!confirm("¿Quitarle el acceso a este curso?")) return;
    await api("/api/admin/cursos/accesos", "DELETE", { id });
    onChanged();
  };

  return (
    <section>
      <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-3">
        <Users size={18} className="text-lgb-red" /> Quién tiene acceso
      </h2>
      <div className="flex gap-2 mb-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@cliente.com" type="email"
          onKeyDown={(e) => e.key === "Enter" && dar()}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
        <button onClick={dar} disabled={busy || !email.trim()}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 cursor-pointer">
          <Plus size={15} /> Dar acceso
        </button>
      </div>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {curso.accesos.length === 0 ? (
        <p className="text-white/30 text-sm">Nadie tiene acceso todavía.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {curso.accesos.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/8 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{a.email}</p>
                <p className="text-white/35 text-[11px] mt-0.5">
                  {a.origen === "manual" ? "Otorgado a mano" : a.origen === "venta" ? "Por compra" : "Regalo"}
                  {a.otorgadoPor ? ` · ${a.otorgadoPor}` : ""} · {new Date(a.createdAt).toLocaleDateString("es-MX")}
                </p>
              </div>
              <button onClick={() => revocar(a.id)} className="text-white/25 hover:text-red-400 transition-colors cursor-pointer shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
