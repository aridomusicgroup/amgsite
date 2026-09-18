"use client";
import { useState } from "react";
import { Plus, Trash2, Users, RefreshCw, Mail } from "lucide-react";
import type { CursoDetalle } from "@/lib/cursos-admin";
import { accesoVigente } from "@/lib/cursos-tipos";
import { inp } from "@/components/admin/tareas/estilos";
import { toast } from "@/lib/toast";
import { api, errorDe } from "./api";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

/** Quién tiene acceso: dar, renovar (mentoría), reenviar el correo y quitar. */
export function AccesosSection({ curso, onChanged }: { curso: CursoDetalle; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const esMentoria = curso.tipo === "mentoria";

  const dar = async () => {
    const v = email.trim().toLowerCase();
    if (!v) return;
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos/accesos", "POST", { curso_id: curso.id, email: v, avisar });
      setEmail("");
      toast(avisar ? "Acceso dado y correo enviado" : "Acceso dado");
      onChanged();
    } catch (e) { setErr(errorDe(e, "Error al dar acceso")); }
    finally { setBusy(false); }
  };

  const accion = async (id: string, body: Record<string, unknown>, ok: string) => {
    try { await api("/api/admin/cursos/accesos", "PATCH", { id, ...body }); toast(ok); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const revocar = async (id: string, correo: string) => {
    if (!confirm(`¿Quitarle el acceso a ${correo}? Deja de ver el curso de inmediato.`)) return;
    try { await api("/api/admin/cursos/accesos", "DELETE", { id }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  return (
    <section>
      <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-1">
        <Users size={18} className="text-lgb-red" /> Quién tiene acceso
      </h2>
      <p className="text-white/40 text-xs mb-3">
        {esMentoria ? "Cada acceso dura un mes; renuévalo cuando pague." : "Acceso de por vida. Las ventas por Stripe se agregan solas."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@cliente.com" type="email"
          onKeyDown={(e) => e.key === "Enter" && dar()} className={inp} />
        <button onClick={dar} disabled={busy || !email.trim()}
          className="shrink-0 flex items-center justify-center gap-1.5 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 cursor-pointer">
          <Plus size={15} /> Dar acceso
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-white/60 mb-4 cursor-pointer w-fit">
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="accent-lgb-red" />
        Mandarle el correo de bienvenida
      </label>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {curso.accesos.length === 0 ? (
        <p className="text-white/40 text-sm">Nadie tiene acceso todavía.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {curso.accesos.map((a) => {
            const vigente = accesoVigente(a.venceEn);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/[0.03] border border-white/8 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{a.email}</p>
                  <p className="text-white/40 text-[11px] mt-0.5">
                    {a.origen === "manual" ? "Otorgado a mano" : a.origen === "venta" ? "Por compra" : "Regalo"}
                    {a.otorgadoPor ? ` · ${a.otorgadoPor}` : ""} · {fecha(a.createdAt)}
                  </p>
                </div>
                {a.venceEn && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${vigente ? "bg-white/8 text-white/60" : "bg-red-500/15 text-red-300"}`}>
                    {vigente ? `Vence ${fecha(a.venceEn)}` : `Venció ${fecha(a.venceEn)}`}
                  </span>
                )}
                {(esMentoria || a.venceEn) && (
                  <button onClick={() => accion(a.id, { accion: "renovar", meses: 1 }, "Renovado 1 mes")}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/8 text-white/70 hover:text-white cursor-pointer">
                    <RefreshCw size={11} /> +1 mes
                  </button>
                )}
                <button onClick={() => accion(a.id, { accion: "reenviar" }, "Correo reenviado")} aria-label="Reenviar correo de acceso" title="Reenviar correo de acceso"
                  className="text-white/30 hover:text-white transition-colors cursor-pointer"><Mail size={14} /></button>
                <button onClick={() => revocar(a.id, a.email)} aria-label="Quitar acceso" className="text-white/30 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
