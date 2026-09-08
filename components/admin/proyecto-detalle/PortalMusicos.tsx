"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, AlertTriangle, Loader2, Check, MailX } from "lucide-react";
import { toast } from "@/lib/toast";

type Asignacion = {
  id: string;
  musico_id: string;
  instrumento: string;
  estado: string;
  musicos: { nombre: string; email: string | null } | null;
};

/** Alguien que recibió el previo de este proyecto y no lo tiene en su portal. */
type Huerfano = {
  musicoId: string;
  nombre: string;
  tieneCorreo: boolean;
  portalActivo: boolean;
  enviadoAt: string;
  tareaId: string | null;
  instrumento: string;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "esperando su grabación",
  entregado: "ya mandó su pista",
  aceptado: "listo",
};

const cuando = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

/**
 * Quién ve este proyecto en /musico — y quién debería verlo y no lo ve.
 *
 * Mandar el previo y darle el trabajo en el portal son dos escrituras
 * distintas, en dos tablas distintas. Cuando se desincronizan no se rompe
 * nada visible: el músico recibe su correo, entra al portal y encuentra el
 * proyecto ANTERIOR, o nada. Desde el estudio se ve idéntico a que todo salió
 * bien, y sólo se descubre cuando el músico se queja.
 *
 * El renglón ámbar es el que hace el trabajo: dice justo eso, y trae el botón
 * para arreglarlo sin salir de aquí.
 */
export function PortalMusicos({ proyectoId }: { proyectoId: string }) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Asignacion[] | null>(null);
  const [huerfanos, setHuerfanos] = useState<Huerfano[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/musico-asignaciones?proyecto_id=${proyectoId}`, { cache: "no-store" });
      if (!r.ok) { setAsignaciones([]); return; }
      const d = await r.json();
      setAsignaciones(d.asignaciones ?? []);
      setHuerfanos(d.huerfanos ?? []);
    } catch { setAsignaciones([]); }
  }, [proyectoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const darselo = async (h: Huerfano) => {
    setBusy(h.musicoId);
    try {
      const r = await fetch("/api/admin/musico-asignaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          musico_id: h.musicoId, proyecto_id: proyectoId, tarea_id: h.tareaId,
          instrumento: h.instrumento,
          // Ya recibió el correo del previo hace rato; un segundo correo con el
          // mismo enlace sólo lo confunde. Se le avisa sólo si el previo es de
          // hoy —ahí los dos correos se leen como uno.
          avisar: Date.now() - new Date(h.enviadoAt).getTime() < 24 * 60 * 60 * 1000,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo"}`); return; }
      toast(d.avisado ? `✓ Ya lo tiene en su portal — se le avisó a ${d.avisado}` : "✓ Ya lo tiene en su portal");
      await cargar();
      router.refresh();
    } finally { setBusy(null); }
  };

  if (asignaciones === null) return null;
  if (!asignaciones.length && !huerfanos.length) return null;

  return (
    <div>
      <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">En el portal del músico</p>
      <div className="space-y-1.5">
        {asignaciones.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
            <UserCheck size={14} className="text-green-400/60 shrink-0" />
            <span className="text-sm text-white/75 min-w-0 flex-1 truncate">
              {a.musicos?.nombre ?? "—"}<span className="text-white/35"> · {a.instrumento}</span>
            </span>
            {!a.musicos?.email && (
              <MailX size={11} className="text-amber-300/70 shrink-0" aria-label="Sin correo: no se le puede avisar" />
            )}
            <span className="text-[11px] text-white/30 shrink-0">{ESTADO_LABEL[a.estado] ?? a.estado}</span>
          </div>
        ))}

        {huerfanos.map((h) => (
          <div key={h.musicoId} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
            <AlertTriangle size={14} className="text-amber-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80 truncate">{h.nombre}</p>
              <p className="text-[11px] text-amber-200/70">
                Le mandaste el previo el {cuando(h.enviadoAt)} y NO lo tiene en su portal.
              </p>
            </div>
            {!h.portalActivo ? (
              <span className="text-[11px] text-amber-200/60 shrink-0">
                No tiene el portal prendido — actívaselo en Ajustes → Músicos
              </span>
            ) : (
              <button onClick={() => darselo(h)} disabled={busy === h.musicoId || !h.instrumento}
                title={h.instrumento
                  ? `Dejárselo en su portal como "${h.instrumento}"`
                  : "No se sabe qué instrumento asignarle: hazlo desde la tarea"}
                className="flex items-center gap-1.5 bg-lgb-red text-white px-2.5 py-1 rounded-lg text-xs hover:bg-red-700 disabled:opacity-40 shrink-0 cursor-pointer">
                {busy === h.musicoId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Dárselo{h.instrumento ? ` · ${h.instrumento}` : ""}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
