"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import { toast } from "@/lib/toast";

const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/**
 * Correos adicionales ligados a un cliente: entran a /cuenta y ven los MISMOS
 * pedidos y contratos que el correo principal. Lo maneja el admin. Solo aplica a
 * contactos con correo (el correo es el login del cliente).
 */
export function ClienteCorreosExtra({ principalEmail }: { principalEmail: string }) {
  const principal = principalEmail.trim().toLowerCase();
  const [correos, setCorreos] = useState<string[] | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch(`/api/admin/cliente-alias?principal=${encodeURIComponent(principal)}`);
      const d = await r.json();
      setCorreos(r.ok ? (d.correos ?? []) : []);
    } catch { setCorreos([]); }
  };
  useEffect(() => { if (principal) cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [principal]);

  const agregar = async () => {
    const alias = nuevo.trim().toLowerCase();
    if (!isEmail(alias)) { toast("Correo inválido"); return; }
    if (alias === principal) { toast("Debe ser distinto al principal"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/cliente-alias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principal_email: principal, alias_email: alias }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo ligar"); return; }
      setNuevo(""); await cargar(); toast("✓ Correo ligado");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const quitar = async (alias: string) => {
    try {
      const r = await fetch("/api/admin/cliente-alias", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias_email: alias }),
      });
      if (r.ok) { await cargar(); toast("✓ Correo quitado"); }
    } catch { toast("Error de red"); }
  };

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  return (
    <div className="col-span-2 sm:col-span-3 mt-1 pt-3 border-t border-white/8">
      <label className="block text-[10px] text-white/40 mb-1.5 flex items-center gap-1">
        <Mail size={11} /> Correos adicionales <span className="text-white/25">(ven los mismos pedidos en su cuenta)</span>
      </label>

      {correos === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {correos.map((e) => (
            <span key={e} className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-full pl-2.5 pr-1 py-1">
              {e}
              <button onClick={() => quitar(e)} className="text-white/30 hover:text-red-300" title="Quitar"><X size={12} /></button>
            </span>
          ))}
          {correos.length === 0 && <span className="text-white/30 text-xs">Ninguno todavía.</span>}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder="otro-correo@ejemplo.com" className={`${inp} flex-1`}
        />
        <button onClick={agregar} disabled={busy} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Ligar"}
        </button>
      </div>
    </div>
  );
}
