"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, Check, Mail, MailX } from "lucide-react";
import { toast } from "@/lib/toast";
import { inp, lblS } from "./estilos";

export type MusicoLite = { id: string; nombre: string; instrumentos: string[] };

type Asignacion = {
  id: string;
  musico_id: string;
  tarea_id: string | null;
  instrumento: string;
  nota: string | null;
  estado: string;
  musicos: { nombre: string; email: string | null } | null;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "esperando su grabación",
  entregado: "ya mandó su pista",
  aceptado: "listo",
};

/**
 * Asignarle esta tarea a un músico externo.
 *
 * Es la única forma que hay de decirle a alguien de fuera qué le toca grabar:
 * antes de esto, ningún renglón de la base ligaba un músico con un proyecto
 * (los responsables de tarea apuntan todos a `equipo`, que es el equipo interno).
 *
 * El instrumento se guarda EN LA ASIGNACIÓN y se precarga del título de la
 * tarea ("Grabar Charchetas" → "Charchetas"), no del catálogo del músico: hay
 * dos tololoches y dos trombones registrados, así que heredarlo sería ambiguo.
 */
export function AsignarMusico({ proyectoId, tareaId, tituloTarea, musicos }: {
  proyectoId: string;
  tareaId: string;
  tituloTarea: string;
  musicos: MusicoLite[];
}) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [musicoId, setMusicoId] = useState("");
  const [instrumento, setInstrumento] = useState(() => tituloTarea.replace(/^grabar\s+/i, "").trim());
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/musico-asignaciones?proyecto_id=${proyectoId}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setAsignaciones((d.asignaciones ?? []).filter((a: Asignacion) => a.tarea_id === tareaId));
    } catch { /* la ventana sigue sirviendo sin esto */ }
  }, [proyectoId, tareaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const asignar = async () => {
    if (!musicoId) { toast("⚠️ Elige a quién"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/musico-asignaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musico_id: musicoId, proyecto_id: proyectoId, tarea_id: tareaId, instrumento, nota, avisar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo asignar"}`); return; }
      toast(d.avisado ? `✓ Asignado — le llegó el enlace a ${d.avisado}` : "✓ Asignado (sin correo)");
      setAbierto(false); setMusicoId(""); setNota("");
      await cargar();
      router.refresh();
    } finally { setBusy(false); }
  };

  const quitar = async (a: Asignacion) => {
    if (!confirm(`¿Quitarle ${a.instrumento} a ${a.musicos?.nombre ?? "ese músico"}?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/musico-asignaciones?id=${a.id}`, { method: "DELETE" });
      if (!r.ok) { toast("⚠️ No se pudo quitar"); return; }
      await cargar();
      router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Músico externo</p>

      {asignaciones.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {asignaciones.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/8 px-2.5 py-2">
              <UserPlus size={13} className="text-lgb-red shrink-0" />
              <span className="text-sm min-w-0 flex-1 truncate">
                {a.musicos?.nombre ?? "—"}
                <span className="text-white/35"> · {a.instrumento}</span>
              </span>
              <span className="text-[10px] text-white/30 shrink-0">{ESTADO_LABEL[a.estado] ?? a.estado}</span>
              {a.musicos?.email
                ? <Mail size={11} className="text-white/25 shrink-0" aria-label="Tiene correo" />
                : <MailX size={11} className="text-amber-300/70 shrink-0" aria-label="Sin correo: no se le puede avisar" />}
              <button onClick={() => quitar(a)} disabled={busy} className="text-white/25 hover:text-red-300 shrink-0 cursor-pointer"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {!abierto ? (
        musicos.length === 0 ? (
          <p className="text-[11px] text-white/25">
            Nadie tiene el portal prendido todavía. Se activa por músico en Ajustes → Músicos.
          </p>
        ) : (
          <button onClick={() => setAbierto(true)}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer">
            <UserPlus size={14} /> Asignar a un músico
          </button>
        )
      ) : (
        <div className="rounded-xl border border-white/10 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lblS}>Quién graba</label>
              <select value={musicoId} onChange={(e) => setMusicoId(e.target.value)} className={inp}>
                <option value="" className="bg-lgb-dark">— elige —</option>
                {musicos.map((m) => (
                  <option key={m.id} value={m.id} className="bg-lgb-dark">
                    {m.nombre}{m.instrumentos.length ? ` — ${m.instrumentos.join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lblS}>Qué toca <span className="text-white/25">(en esta canción)</span></label>
              <input value={instrumento} onChange={(e) => setInstrumento(e.target.value)} placeholder="Charchetas" className={inp} />
            </div>
          </div>

          <div>
            <label className={lblS}>Indicaciones <span className="text-white/25">(lo único que va a leer)</span></label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              placeholder="Entra en el segundo coro, deja aire en los versos…" className={inp} />
          </div>

          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="accent-lgb-red" />
            Mandarle el enlace por correo ahora
          </label>

          <div className="flex gap-2">
            <button onClick={asignar} disabled={busy || !musicoId || !instrumento.trim()}
              className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 cursor-pointer">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Asignar
            </button>
            <button onClick={() => setAbierto(false)} className="text-white/50 hover:text-white text-sm px-2 cursor-pointer">Cancelar</button>
          </div>

          <p className="text-white/25 text-[11px]">
            Solo va a ver el nombre de la canción, su instrumento y estas indicaciones — nunca al cliente ni montos.
          </p>
        </div>
      )}
    </div>
  );
}
