"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, X, ArrowRight, Clock, FolderOpen } from "lucide-react";
import { toast } from "@/lib/toast";
import { PAQUETES } from "@/lib/servicios";
import { TIPO_PROY_LABEL } from "@/lib/erp-data";

type Fila = {
  ambito: string; llave: string; archivo: string;
  alias: string; activo: boolean; nota: string; existe: boolean;
};

/**
 * Qué archivo .rpp se copia para cada servicio vendido.
 *
 * Hasta hoy toda producción nacía del mismo PLANTILLA.rpp: 47 pistas donde no
 * existe BATERÍA, ACORDEÓN ni BAJOQUINTO, así que un Paquete Empedes nacía sin
 * un solo lugar donde meter tres de sus cuatro instrumentos.
 *
 * Las plantillas se arman a mano en REAPER —aquí sólo se elige cuál— porque la
 * plantilla tiene 27 envíos que apuntan a otras pistas por índice: quitar una
 * por código correría los índices y dejaría los envíos apuntando a la pista
 * equivocada, sin tronar.
 *
 * La lista de archivos disponibles la publica el script local en cada corrida:
 * el panel vive en Vercel y no puede leer el disco del estudio.
 */
export function ReaperPlantillasSection() {
  const [mapa, setMapa] = useState<Fila[] | null>(null);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [escaneado, setEscaneado] = useState<string | null>(null);
  const [sinTabla, setSinTabla] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState({ ambito: "paquete", llave: "", archivo: "", alias: "" });

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  const cargar = async () => {
    try {
      const r = await fetch("/api/admin/reaper-plantillas", { cache: "no-store" });
      if (!r.ok) { setMapa([]); return; }
      const d = await r.json();
      setMapa(d.mapa ?? []);
      setArchivos(d.archivosDisco ?? []);
      setEscaneado(d.escaneadoEn ?? null);
      setSinTabla(Boolean(d.sinTabla));
    } catch { setMapa([]); }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!nuevo.llave.trim() || !nuevo.archivo.trim()) { toast("⚠️ Elige el servicio y el archivo"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/reaper-plantillas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }
      setNuevo({ ambito: "paquete", llave: "", archivo: "", alias: "" });
      await cargar();
      toast("✓ Guardado");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const quitar = async (f: Fila) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/reaper-plantillas?ambito=${encodeURIComponent(f.ambito)}&llave=${encodeURIComponent(f.llave)}`, { method: "DELETE" });
      if (r.ok) { await cargar(); toast("✓ Quitado — ese servicio vuelve a la plantilla general"); }
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  // El nombre bonito de una llave, según su ámbito.
  const etiqueta = (f: { ambito: string; llave: string }) =>
    f.ambito === "paquete"
      ? (PAQUETES.find((p) => p.id === f.llave)?.nombre ?? f.llave)
      : (TIPO_PROY_LABEL[f.llave] ?? f.llave);

  const opciones = nuevo.ambito === "paquete"
    ? PAQUETES.map((p) => ({ id: p.id, nombre: p.nombre }))
    : Object.entries(TIPO_PROY_LABEL).map(([id, nombre]) => ({ id, nombre: String(nombre) }));

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-lg">Servicio → plantilla de REAPER</h2>
      <p className="text-white/40 text-xs mt-0.5 mb-3">
        Con qué archivo nace cada proyecto. Lo que no esté aquí usa
        <b className="text-white/60"> PLANTILLA.rpp</b> y queda el aviso en la consola de REAPER — nunca se
        deja un proyecto sin crear. El <b className="text-white/60">paquete gana sobre el tipo</b>: Tumbes,
        Alucines y Empedes son tres instrumentaciones distintas y los tres son &ldquo;Grabación&rdquo;.
      </p>

      {sinTabla && (
        <p className="text-amber-300/70 text-xs mb-3">
          Falta correr <code className="text-amber-300">supabase-reaper-plantillas.sql</code>. Mientras tanto
          todo nace de la plantilla general, igual que siempre.
        </p>
      )}

      <datalist id="rpps-en-disco">
        {archivos.map((a) => <option key={a} value={a} />)}
      </datalist>

      {mapa === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {mapa.map((f) => (
            <li key={`${f.ambito}|${f.llave}`} className="flex items-center gap-2 bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-white/25 w-14 shrink-0">{f.ambito}</span>
              <span className="text-sm w-36 shrink-0 truncate">{etiqueta(f)}</span>
              <ArrowRight size={12} className="text-white/25 shrink-0" />
              <span className="text-sm text-lgb-red flex-1 min-w-0 truncate">
                {f.archivo}
                {f.alias && <span className="text-white/40"> · alias {f.alias}</span>}
              </span>
              {!f.existe && (
                <span
                  title={escaneado
                    ? `Ese archivo no estaba en la carpeta cuando el script revisó (${new Date(escaneado).toLocaleString("es-MX")}). Los proyectos nacen con la general hasta que exista.`
                    : "El script todavía no ha publicado qué hay en el disco. Espera una corrida (2 min)."}
                  className="flex items-center gap-1 text-[10px] text-amber-300/70 shrink-0">
                  <Clock size={10} /> no está en disco
                </span>
              )}
              <button onClick={() => quitar(f)} disabled={busy}
                className="text-white/25 hover:text-red-300 shrink-0 cursor-pointer disabled:opacity-40"><X size={14} /></button>
            </li>
          ))}
          {mapa.length === 0 && !sinTabla && (
            <li className="text-white/30 text-xs">Sin plantillas por servicio. Todo nace de PLANTILLA.rpp.</li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        <select value={nuevo.ambito}
          onChange={(e) => setNuevo((s) => ({ ...s, ambito: e.target.value, llave: "" }))}
          className={`${inp} w-28 cursor-pointer`}>
          <option value="paquete" className="bg-lgb-dark">Paquete</option>
          <option value="tipo" className="bg-lgb-dark">Tipo</option>
        </select>
        <select value={nuevo.llave} onChange={(e) => setNuevo((s) => ({ ...s, llave: e.target.value }))}
          className={`${inp} w-44 cursor-pointer`}>
          <option value="" className="bg-lgb-dark">— elige —</option>
          {opciones.map((o) => <option key={o.id} value={o.id} className="bg-lgb-dark">{o.nombre}</option>)}
        </select>
        <ArrowRight size={13} className="text-white/25" />
        <input value={nuevo.archivo} onChange={(e) => setNuevo((s) => ({ ...s, archivo: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
          list="rpps-en-disco" placeholder="Archivo .rpp" className={`${inp} flex-1 min-w-[170px]`} />
        <input value={nuevo.alias} onChange={(e) => setNuevo((s) => ({ ...s, alias: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
          title="Otras formas en que ese paquete aparece escrito en las cotizaciones, separadas por coma."
          placeholder="Alias (opcional)" className={`${inp} w-40`} />
        <button onClick={guardar} disabled={busy}
          className="flex items-center gap-1 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Guardar
        </button>
      </div>

      <p className="text-white/25 text-[10px] mt-1.5 flex items-start gap-1">
        <FolderOpen size={11} className="mt-0.5 shrink-0" />
        <span>
          Guarda el <b className="text-white/40">.rpp</b> en la raíz de la carpeta de REAPER y espera una corrida
          (2 min) para que aparezca en la lista. Que <b className="text-white/40">no empiece con &ldquo;_&rdquo;</b>:
          esos se ignoran. Y al estrenar una plantilla con pistas nuevas, llena también
          <b className="text-white/40"> Instrumento → pista</b> con ellas, o lo que mande un músico seguirá
          cayendo en una pista suelta al final aunque la correcta ya exista.
          {archivos.length > 0 && <> Hoy hay {archivos.length} archivo(s) disponibles.</>}
        </span>
      </p>
    </div>
  );
}
