"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Loader2, Lock, X, Radio, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { ROLE_MODULES, MODULES, GRUPOS, GRUPO_LABEL, moduleLabel, moduleDef, type Grupo } from "@/lib/modules";
import { toast } from "@/lib/toast";
import { MusicosSection } from "./MusicosSection";
import { PerfilSection } from "./PerfilSection";

const FONTS = [{ k: "sm", label: "Chico" }, { k: "md", label: "Mediano" }, { k: "lg", label: "Grande" }];
const ROL_LABEL: Record<string, string> = { admin: "Admin", crm: "CRM / Marketing", produccion: "Producción" };

type Usuario = { email: string; role: string; activo: boolean; modules_extra: string[] | null; nombre?: string | null; foto_url?: string | null };
const ROLES = ["admin", "crm", "produccion"] as const;

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-lg">{title}</h2>
      {desc && <p className="text-white/40 text-xs mt-0.5 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

const chip = (active: boolean) =>
  `px-4 py-1.5 rounded-full text-sm transition-colors ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

export function AjustesPanel({ fontSize, theme, moduleOrder, modules, isAdmin, usuarios, selfEmail, selfNombre, selfFoto }: {
  fontSize: string; theme: string; moduleOrder: string[] | null; modules: string[]; isAdmin: boolean;
  usuarios: Usuario[]; selfEmail: string; selfNombre: string | null; selfFoto: string | null;
}) {
  const router = useRouter();

  const ordenInicial = () => {
    if (!moduleOrder) return modules;
    const ord = moduleOrder.filter((h) => modules.includes(h));
    for (const h of modules) if (!ord.includes(h)) ord.push(h);
    return ord;
  };
  const [orden, setOrden] = useState<string[]>(ordenInicial());
  const ordenPropio = Boolean(moduleOrder && moduleOrder.length);
  const [busy, setBusy] = useState(false);

  const guardarFont = async (k: string) => {
    setBusy(true);
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ font_size: k }) });
    setBusy(false);
    router.refresh();
    toast("✓ Tamaño aplicado");
  };

  const guardarTema = async (t: string) => {
    if (t === theme) return;
    setBusy(true);
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: t }) });
    setBusy(false);
    router.refresh();
    toast(t === "light" ? "☀️ Modo claro" : "🌙 Modo oscuro");
  };

  /**
   * Sube o baja una sección DENTRO de su área.
   *
   * El menú de escritorio agrupa por área, así que intercambiar con el vecino
   * de la lista plana movería la sección de área sin avisar. Se busca al vecino
   * más cercano de la misma área y se cambia con ese.
   */
  const mover = async (href: string, dir: -1 | 1) => {
    const i = orden.indexOf(href);
    const g = moduleDef(href)?.grupo;
    let j = i + dir;
    while (j >= 0 && j < orden.length && moduleDef(orden[j])?.grupo !== g) j += dir;
    if (j < 0 || j >= orden.length) return;
    const next = [...orden];
    [next[i], next[j]] = [next[j], next[i]];
    setOrden(next);
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module_order: next }) });
    router.refresh();
    toast("✓ Orden guardado");
  };

  /** Vaciar el orden propio devuelve el acomodo de fábrica dentro de cada área. */
  const restablecerOrden = async () => {
    setBusy(true);
    await fetch("/api/admin/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module_order: [] }) });
    setBusy(false);
    router.refresh();
    toast("✓ Orden de fábrica");
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Section title="Mi perfil" desc="Cómo te ve el resto del equipo en el panel.">
        <PerfilSection email={selfEmail} nombre={selfNombre} fotoUrl={selfFoto} />
      </Section>

      <Section title="Mi panel" desc="Estos ajustes son solo tuyos: nadie más los ve.">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs text-white/50 mb-2">Tamaño de letra</p>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button key={f.k} onClick={() => guardarFont(f.k)} disabled={busy} className={chip(fontSize === f.k)}>{f.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-white/50 mb-2">Tema</p>
            <div className="flex gap-2">
              <button onClick={() => guardarTema("dark")} disabled={busy} className={chip(theme !== "light")}>🌙 Oscuro</button>
              <button onClick={() => guardarTema("light")} disabled={busy} className={chip(theme === "light")}>☀️ Claro</button>
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-xs text-white/50">Orden de tus secciones</p>
              {ordenPropio && (
                <button onClick={restablecerOrden} disabled={busy} className="text-[11px] text-white/30 hover:text-white transition-colors cursor-pointer disabled:opacity-40">
                  restablecer
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {GRUPOS.map((g) => {
                // Mismo reparto que el menú lateral, para que esta lista no
                // prometa un acomodo distinto al que se ve.
                const items = orden.filter((h) => h !== "/admin" && moduleDef(h)?.grupo === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">{GRUPO_LABEL[g]}</p>
                    <div className="flex flex-col gap-1.5">
                      {items.map((h, i) => (
                        <div key={h} className="flex items-center gap-2 bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2">
                          <span className="text-sm flex-1">{moduleLabel(h)}</span>
                          <button onClick={() => mover(h, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ArrowUp size={15} /></button>
                          <button onClick={() => mover(h, 1)} disabled={i === items.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 cursor-pointer"><ArrowDown size={15} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-white/25 text-[11px] mt-2">
              En escritorio el menú va agrupado por áreas y cada una se abre y cierra con un clic en su título. Las flechas acomodan las secciones dentro de su área; Inicio siempre va hasta arriba.
            </p>
          </div>
        </div>
      </Section>

      {isAdmin && <EquipoSection usuarios={usuarios} selfEmail={selfEmail} />}

      {isAdmin && <MusicosSection />}
    </div>
  );
}

// ── Equipo y accesos: fuente de verdad en la tabla `usuarios` (login + tiempo real) ──
function EquipoSection({ usuarios, selfEmail }: { usuarios: Usuario[]; selfEmail: string }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState("");
  const [rolNuevo, setRolNuevo] = useState<string>("produccion");
  const [busy, setBusy] = useState(false);
  // Una fila abierta a la vez: doce interruptores por usuario, todos visibles a
  // la vez, era justo lo que hacía ilegible esta pantalla.
  const [abierta, setAbierta] = useState<string | null>(null);
  const yo = selfEmail.toLowerCase();

  const call = async (method: string, body?: Record<string, unknown>, qs = "") => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/usuarios${qs}`, {
        method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "Error"}`); return false; }
      router.refresh();
      return true;
    } finally { setBusy(false); }
  };

  const agregar = async () => {
    const email = nuevo.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("⚠️ Correo inválido"); return; }
    if (await call("POST", { email, rol: rolNuevo })) { toast("✓ Usuario agregado"); setNuevo(""); }
  };
  const cambiarRol = (email: string, rol: string) => call("PATCH", { email, rol });
  const toggleActivo = (u: Usuario) => call("PATCH", { email: u.email, activo: !u.activo });
  const eliminar = (email: string) => { if (confirm(`¿Quitar el acceso de ${email}?`)) call("DELETE", undefined, `?email=${encodeURIComponent(email)}`); };

  return (
    <Section title="Equipo y accesos" desc="Quién entra al panel, con qué rol y a qué secciones. Los cambios llegan en tiempo real a quien esté conectado.">
      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <FilaUsuario
            key={u.email}
            u={u}
            esYo={u.email.toLowerCase() === yo}
            busy={busy}
            abierta={abierta === u.email}
            onAbrir={() => setAbierta(abierta === u.email ? null : u.email)}
            onRol={(rol) => cambiarRol(u.email, rol)}
            onActivo={() => toggleActivo(u)}
            onEliminar={() => eliminar(u.email)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
          placeholder="correo@ejemplo.com" type="email"
          className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-lgb-red" />
        <select value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red">
          {ROLES.map((r) => <option key={r} value={r} className="bg-lgb-dark">{ROL_LABEL[r]}</option>)}
        </select>
        <button onClick={agregar} disabled={busy || !nuevo.trim()}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-3 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40"><Plus size={15} /> Agregar</button>
      </div>

      <p className="text-white/30 text-[11px] mt-3">
        Para entrar la primera vez, la persona usa <b className="text-white/50">“Entrar con enlace”</b> en el login con su correo (crea su cuenta). Después puede definir su contraseña.
      </p>
    </Section>
  );
}

/** Una persona: identidad y rol arriba, sus accesos al desplegar. */
function FilaUsuario({ u, esYo, busy, abierta, onAbrir, onRol, onActivo, onEliminar }: {
  u: Usuario; esYo: boolean; busy: boolean; abierta: boolean;
  onAbrir: () => void; onRol: (rol: string) => void; onActivo: () => void; onEliminar: () => void;
}) {
  const cfg = ROLE_MODULES[u.role] ?? ROLE_MODULES.produccion;
  const [extras, setExtras] = useState<string[]>(u.modules_extra ?? cfg.defaultOn);
  const esAdmin = u.role === "admin";
  const total = esAdmin ? MODULES.length : cfg.base.length + cfg.optional.length;
  const activos = esAdmin ? MODULES.length : cfg.base.length + cfg.optional.filter((h) => extras.includes(h)).length;

  /** Foto (o iniciales) + nombre, con el correo debajo cuando hay nombre. */
  const identidad = (
    <>
      {u.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.foto_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-white/5 text-white/40 text-[9px] flex items-center justify-center shrink-0">
          {(u.nombre || u.email).slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-sm truncate block">
          {u.nombre || u.email}
          {esYo && <span className="text-white/30"> · tú</span>}
          {!u.activo && <span className="text-amber-300/70"> · inactivo</span>}
        </span>
        {u.nombre && <span className="text-[10px] text-white/25 truncate block">{u.email}</span>}
      </span>
    </>
  );

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <Radio size={14} className={u.activo ? "text-lgb-red" : "text-white/15"} />
        {esAdmin ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="w-[13px] shrink-0" />
            {identidad}
            <span className="text-[11px] text-white/30 shrink-0 ml-1" title="El rol de administrador incluye todo el panel">
              ve todo el panel
            </span>
          </div>
        ) : (
          <button
            onClick={onAbrir}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer group"
            title="Ver y repartir sus accesos"
          >
            {abierta ? <ChevronDown size={13} className="text-white/40 shrink-0" /> : <ChevronRight size={13} className="text-white/25 shrink-0 group-hover:text-white/50" />}
            {identidad}
            <span className="text-[11px] text-white/30 shrink-0 ml-1">{activos}/{total}</span>
          </button>
        )}
        <select value={u.role} onChange={(e) => onRol(e.target.value)} disabled={busy || esYo}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-lgb-red disabled:opacity-50">
          {ROLES.map((r) => <option key={r} value={r} className="bg-lgb-dark">{ROL_LABEL[r]}</option>)}
        </select>
        <button onClick={onActivo} disabled={busy || esYo} title={u.activo ? "Desactivar" : "Activar"}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors disabled:opacity-40 cursor-pointer ${u.activo ? "bg-lgb-red/15 text-lgb-red hover:bg-lgb-red/25" : "bg-white/5 text-white/50 hover:text-white"}`}>
          {u.activo ? "Activo" : "Inactivo"}
        </button>
        <button onClick={onEliminar} disabled={busy || esYo} className="text-white/25 hover:text-red-300 disabled:opacity-20 cursor-pointer"><X size={15} /></button>
      </div>

      {abierta && !esAdmin && (
        <div className="border-t border-white/8 px-3 py-3">
          <AccesosDeUsuario u={u} extras={extras} onExtras={setExtras} />
        </div>
      )}
    </div>
  );
}

/**
 * Los módulos de una persona, agrupados por área.
 *
 * Antes eran doce chips en una sola fila sin decir qué hacía cada uno; había
 * que saberse el panel de memoria para repartir accesos. Ahora van por área,
 * con una línea de qué hace cada módulo y un atajo para prender/apagar el
 * grupo completo.
 */
function AccesosDeUsuario({ u, extras, onExtras }: {
  u: Usuario; extras: string[]; onExtras: (v: string[]) => void;
}) {
  const router = useRouter();
  const cfg = ROLE_MODULES[u.role] ?? ROLE_MODULES.produccion;
  const [busy, setBusy] = useState(false);

  const guardar = async (next: string[]) => {
    onExtras(next);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/user-modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email, modules_extra: next }),
      });
      if (!r.ok) { toast("⚠️ No se pudo guardar"); return; }
      toast("✓ Acceso actualizado");
      router.refresh();
    } finally { setBusy(false); }
  };

  const alternar = (h: string) =>
    guardar(extras.includes(h) ? extras.filter((x) => x !== h) : [...extras, h]);

  /** Prende o apaga de un golpe los opcionales de un área. */
  const grupoCompleto = (g: Grupo, prender: boolean) => {
    const delGrupo = cfg.optional.filter((h) => moduleDef(h)?.grupo === g);
    guardar(prender ? [...new Set([...extras, ...delGrupo])] : extras.filter((x) => !delGrupo.includes(x)));
  };

  return (
    <div className="flex flex-col gap-3">
      {GRUPOS.map((g) => {
        const base = cfg.base.filter((h) => moduleDef(h)?.grupo === g);
        const opcionales = cfg.optional.filter((h) => moduleDef(h)?.grupo === g);
        if (!base.length && !opcionales.length) return null;
        const todos = opcionales.length > 0 && opcionales.every((h) => extras.includes(h));

        return (
          <div key={g}>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] uppercase tracking-wide text-white/35">{GRUPO_LABEL[g]}</p>
              {opcionales.length > 1 && (
                <button
                  onClick={() => grupoCompleto(g, !todos)}
                  disabled={busy}
                  className="text-[10px] text-white/30 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  {todos ? "quitar todo" : "dar todo"}
                </button>
              )}
              {busy && <Loader2 size={11} className="animate-spin text-white/30" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {base.map((h) => (
                <div key={h} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/[0.07]" title="Viene con su rol, no se puede quitar">
                  <Lock size={11} className="text-green-300/60 mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="text-xs text-green-300/80 block">{moduleLabel(h)}</span>
                    <span className="text-[10px] text-white/30 block truncate">{moduleDef(h)?.desc}</span>
                  </span>
                </div>
              ))}
              {opcionales.map((h) => {
                const puesto = extras.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => alternar(h)}
                    disabled={busy}
                    className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-50 ${
                      puesto ? "bg-lgb-red/15 hover:bg-lgb-red/25" : "bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${puesto ? "bg-lgb-red" : "bg-white/15"}`} />
                    <span className="min-w-0">
                      <span className={`text-xs block ${puesto ? "text-white" : "text-white/45"}`}>{moduleLabel(h)}</span>
                      <span className="text-[10px] text-white/30 block truncate">{moduleDef(h)?.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
