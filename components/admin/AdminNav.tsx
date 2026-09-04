"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Bot, ExternalLink, ChevronRight } from "lucide-react";
import { MODULES, GRUPOS, GRUPO_LABEL, type Grupo } from "@/lib/modules";
import { moduleIcon } from "./module-icons";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { VersionWatcher } from "./VersionWatcher";
import { toast } from "@/lib/toast";

// Dashboard del chatbot (proyecto aparte en Vercel, con su propio login).
const CHATBOT_URL = "https://arido-chat-dashboard.vercel.app";

// Tablas que ponen TODO el panel en vivo: cualquier cambio del equipo refresca
// la página abierta al instante (ver supabase-realtime-todo.sql).
const RT_TABLAS = [
  "proyectos", "proyecto_tareas", "proyecto_subtareas", "tarea_recordatorios",
  "contactos", "identidades_canal", "interacciones",
  "cotizaciones", "contratos", "ventas", "pagos", "pagos_musico", "musicos",
  "orders", "order_items", "customers",
  "expenses", "manual_income",
] as const;

/** Los links salen de MODULES (única lista) + su icono. Antes había aquí una
 *  copia a mano de los 16 hrefs y labels que había que mantener en paralelo. */
const allLinks = MODULES.map((m) => ({ href: m.href, label: m.label, grupo: m.grupo, icon: moduleIcon(m.href) }));

/** Debajo de esto, encabezados sobre grupos de una o dos secciones estorban más
 *  de lo que ayudan: quien tiene 3 secciones no necesita índice. */
const MINIMO_PARA_AGRUPAR = 8;

/** La portada del panel va fija hasta arriba, fuera de los grupos. */
const PORTADA = "/admin";

const VISTO_KEY = "arido-actividad-visto";

/** Respaldo del avatar cuando la persona todavía no sube foto. */
function inicialesDe(nombre: string | null | undefined, email: string): string {
  const base = (nombre || "").trim() || email.split("@")[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || base[0].toUpperCase();
}

export function AdminNav({ email, nombre, foto, modules, order, colapsado }: {
  email: string; nombre?: string | null; foto?: string | null;
  modules: string[]; order?: string[] | null; colapsado?: string[] | null;
}) {
  const pathname = usePathname();

  // Tiempo real en TODO el panel: una sola suscripción (la nav está en todas
  // las páginas) refresca la vista abierta cuando alguien del equipo cambia algo.
  useRealtimeRefresh("rt-panel", RT_TABLAS);

  // Puntito de novedades en Producción: misma fuente que la campana de Actividad.
  // Cuenta la actividad más nueva que la última vista (localStorage compartido).
  const [novedades, setNovedades] = useState(0);
  useEffect(() => {
    if (!modules.includes("/admin/produccion")) return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/admin/actividad?limit=60", { cache: "no-store" });
        const d = await r.json();
        const items: { created_at: string }[] = Array.isArray(d.actividad) ? d.actividad : [];
        let visto = "";
        try { visto = localStorage.getItem(VISTO_KEY) || ""; } catch { /* */ }
        if (alive) setNovedades(items.filter((i) => !visto || i.created_at > visto).length);
      } catch { /* */ }
    };
    check();
    const t = setInterval(check, 60_000);
    const onVisto = () => setNovedades(0);      // la campana marcó todo como visto
    const onFocus = () => check();
    window.addEventListener("arido-actividad-visto", onVisto);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("arido-actividad-visto", onVisto);
      window.removeEventListener("focus", onFocus);
    };
  }, [modules]);
  const hayNovedades = novedades > 0;

  let links = allLinks.filter((l) => modules.includes(l.href));
  if (order && order.length) {
    links = [...links].sort((a, b) => {
      const ia = order.indexOf(a.href), ib = order.indexOf(b.href);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

  /**
   * Los mismos links, repartidos por área — SOLO para el menú de escritorio.
   * `links` (plano) sigue siendo lo único que alimenta la barra móvil.
   *
   * El orden que la persona acomodó a mano NO apaga el agrupado: manda dentro
   * de cada área (los items ya vienen ordenados de arriba). Antes lo apagaba,
   * y el resultado era que los dos que más usan el panel —justo los que habían
   * acomodado su menú— eran los únicos que nunca veían las áreas.
   */
  const portada = links.find((l) => l.href === PORTADA) ?? null;
  const agrupado =
    links.length >= MINIMO_PARA_AGRUPAR
      ? GRUPOS.map((g) => ({
          grupo: g as Grupo,
          items: links.filter((l) => l.grupo === g && l.href !== PORTADA),
        })).filter((s) => s.items.length > 0)
      : null;

  /**
   * Áreas cerradas. Optimista: se pinta al instante y se guarda de fondo, para
   * que abrir y cerrar no dependa de la red. Si el guardado falla se avisa y se
   * revierte — si no, la próxima recarga desharía el cambio sin explicación.
   */
  const [cerradas, setCerradas] = useState<string[]>(colapsado ?? []);
  const alternarArea = (g: Grupo) => {
    const antes = cerradas;
    const next = antes.includes(g) ? antes.filter((x) => x !== g) : [...antes, g];
    setCerradas(next);
    fetch("/api/admin/prefs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nav_colapsado: next }),
    })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => { setCerradas(antes); toast("⚠️ No se pudo guardar el menú"); });
  };

  const logout = async () => {
    const supabase = createAuthClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // El área que contiene la página abierta se muestra aunque esté cerrada: dejar
  // de ver dónde estás parado por un colapso guardado hace semanas es peor que
  // el ahorro de espacio. No se toca lo guardado; al navegar fuera vuelve a cerrarse.
  const grupoActivo = links.find((l) => l.href !== PORTADA && isActive(l.href))?.grupo;

  /** Un link del menú de escritorio. Se usa igual agrupado o plano. */
  const linkEscritorio = (l: (typeof allLinks)[number]) => {
    const Icon = l.icon;
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
          isActive(l.href) ? "bg-lgb-red text-white" : "text-white/50 hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon size={17} />
        {l.label}
        {l.href === "/admin/produccion" && hayNovedades && (
          <span className="ml-auto w-2 h-2 rounded-full bg-lgb-red" title="Hay novedades" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Aviso de versión nueva (tras inactividad) */}
      <VersionWatcher />

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-lgb-dark border-r border-white/5 flex-col p-4">
        <div className="px-2 py-3 mb-4">
          <Image
            src="/logos/arido-blanco.png"
            alt="ARIDO"
            width={120}
            height={40}
            className="h-9 w-auto object-contain light:hidden"
          />
          <Image
            src="/logos/arido-color.png"
            alt="ARIDO"
            width={120}
            height={40}
            className="h-9 w-auto object-contain hidden light:block"
          />
          <p className="text-white/30 text-[10px] mt-2 tracking-widest uppercase">
            Panel de control
          </p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {agrupado ? (
            <>
              {portada && linkEscritorio(portada)}
              {agrupado.map((s) => {
                const abierta = !cerradas.includes(s.grupo) || s.grupo === grupoActivo;
                // Si Producción quedó escondida, su puntito sube al encabezado:
                // un aviso que no se ve es un aviso perdido.
                const avisa = !abierta && hayNovedades && s.items.some((l) => l.href === "/admin/produccion");
                return (
                  <div key={s.grupo} className="mt-3 first:mt-0">
                    <button
                      onClick={() => alternarArea(s.grupo)}
                      aria-expanded={abierta}
                      title={abierta ? "Cerrar esta área" : "Abrir esta área"}
                      className="w-full flex items-center gap-1 px-3 pb-1 text-left cursor-pointer group/area"
                    >
                      <ChevronRight
                        size={10}
                        className={`shrink-0 text-white/25 transition-transform duration-200 motion-reduce:transition-none ${abierta ? "rotate-90" : ""}`}
                      />
                      <span className="text-[10px] uppercase tracking-wider text-white/25 group-hover/area:text-white/50 transition-colors">
                        {GRUPO_LABEL[s.grupo]}
                      </span>
                      {avisa && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lgb-red" title="Hay novedades adentro" />}
                    </button>

                    {/* 0fr → 1fr: se desliza sin tener que saber de antemano cuánto mide. */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                        abierta ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="flex flex-col gap-1">{s.items.map(linkEscritorio)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            links.map(linkEscritorio)
          )}

          {/* Acceso directo al chatbot (herramienta externa) */}
          <a
            href={CHATBOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Bot size={17} />
            Chatbot
            <ExternalLink size={12} className="ml-auto opacity-40" />
          </a>
        </nav>

        <div className="border-t border-white/5 pt-3">
          {/* Quién está usando el panel. Lleva a Ajustes, que es donde se edita. */}
          <Link href="/admin/ajustes" className="flex items-center gap-2.5 px-3 mb-2 group" title="Ver mi perfil">
            {foto ? (
              // <img> normal: el avatar mide 28px y next/image obligaría a tocar remotePatterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-lgb-red/15 text-lgb-red text-[10px] flex items-center justify-center shrink-0">
                {inicialesDe(nombre, email)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-xs text-white/60 group-hover:text-white truncate transition-colors">{nombre || email}</span>
              {nombre && <span className="block text-[10px] text-white/25 truncate">{email}</span>}
            </span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors w-full cursor-pointer"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Barra inferior móvil (scrollable: caben todas las secciones).
          El padding inferior respeta el "safe area" del iPhone para que la barra
          suba y no choque con la barra de gestos/home indicator. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-lgb-dark border-t border-white/10 flex items-center gap-1.5 overflow-x-auto hide-scrollbar px-2 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.6rem)" }}
      >
        {links.map((l) => {
          const Icon = l.icon;
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-xl text-[11px] shrink-0 ${
                active ? "text-lgb-red bg-lgb-red/10" : "text-white/45"
              }`}
            >
              <Icon size={23} />
              {l.label}
              {l.href === "/admin/produccion" && hayNovedades && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-lgb-red" />
              )}
            </Link>
          );
        })}
        <a
          href={CHATBOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-xl text-[11px] text-white/45 shrink-0"
        >
          <Bot size={23} />
          Chatbot
        </a>
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-xl text-white/45 cursor-pointer shrink-0"
        >
          <LogOut size={23} />
          <span className="text-[11px]">Salir</span>
        </button>
      </nav>
    </>
  );
}
