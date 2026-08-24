"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, GraduationCap, Users, ListVideo, X } from "lucide-react";
import type { CursoAdmin } from "@/lib/cursos-admin";

interface Props {
  cursos: CursoAdmin[];
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

export function CursosPanel({ cursos }: Props) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/40 text-sm">{cursos.length} curso{cursos.length === 1 ? "" : "s"}</p>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
        >
          <Plus size={16} /> Nuevo curso
        </button>
      </div>

      {cursos.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <GraduationCap size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-sm">Aún no hay cursos. Crea el primero para empezar a armar el contenido.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((c) => (
            <Link
              key={c.id}
              href={`/admin/cursos/${c.id}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-coolvetica text-lg leading-snug">{c.titulo}</p>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${c.activo ? "bg-green-500/15 text-green-400" : "bg-white/10 text-white/40"}`}>
                  {c.activo ? "Activo" : "Oculto"}
                </span>
              </div>
              {c.descripcion && <p className="text-white/40 text-xs mb-3 line-clamp-2">{c.descripcion}</p>}
              <div className="flex items-center gap-4 text-white/50 text-xs">
                <span className="flex items-center gap-1.5"><ListVideo size={13} /> {c.numModulos} módulos · {c.numLecciones} lecciones</span>
                <span className="flex items-center gap-1.5"><Users size={13} /> {c.numAlumnos}</span>
              </div>
              {c.precioMxn !== null && (
                <p className="text-white text-sm font-coolvetica mt-3">${c.precioMxn.toLocaleString("es-MX")} <span className="text-white/30 text-[11px] font-sans">MXN</span></p>
              )}
            </Link>
          ))}
        </div>
      )}

      {creando && <NuevoCursoModal onClose={() => setCreando(false)} onCreated={(id) => router.push(`/admin/cursos/${id}`)} />}
    </div>
  );
}

function NuevoCursoModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const crear = async () => {
    if (!titulo.trim()) { setErr("Ponle un título."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api("/api/admin/cursos", "POST", {
        titulo, descripcion: descripcion || null, precio_mxn: precio ? Number(precio) : null,
      });
      onCreated(r.id);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al crear"); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-lgb-dark border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-coolvetica text-lg">Nuevo curso</p>
          <button onClick={onClose} className="text-white/40 hover:text-white cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-xs text-white/50 mb-1">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
          </label>
          <label className="block">
            <span className="block text-xs text-white/50 mb-1">Descripción (opcional)</span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red resize-none" />
          </label>
          <label className="block">
            <span className="block text-xs text-white/50 mb-1">Precio en MXN (opcional)</span>
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" min="0" placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red" />
          </label>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button onClick={crear} disabled={busy}
            className="mt-1 bg-lgb-red text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
            {busy ? "Creando…" : "Crear curso"}
          </button>
        </div>
      </div>
    </div>
  );
}
