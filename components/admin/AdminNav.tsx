"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Wallet, Users, Music2, Receipt, DownloadCloud, Megaphone, ClipboardList, BarChart3, TrendingUp, Settings, LogOut, Bot, ExternalLink, FileText, History, GraduationCap } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { VersionWatcher } from "./VersionWatcher";

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

const allLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produccion", label: "Producción", icon: ClipboardList },
  { href: "/admin/actividad", label: "Actividad", icon: History },
  { href: "/admin/rendimiento", label: "Rendimiento", icon: BarChart3 },
  { href: "/admin/analitica", label: "Analítica", icon: TrendingUp },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/pedidos", label: "Pedidos", icon: Package },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/admin/ventas", label: "Ventas", icon: Receipt },
  { href: "/admin/beats", label: "Beats", icon: Music2 },
  { href: "/admin/cursos", label: "Cursos", icon: GraduationCap },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/importar", label: "Importar", icon: DownloadCloud },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
];

const VISTO_KEY = "arido-actividad-visto";

export function AdminNav({ email, modules, order }: { email: string; modules: string[]; order?: string[] | null }) {
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

  const logout = async () => {
    const supabase = createAuthClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

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
          {links.map((l) => {
            const Icon = l.icon;
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-lgb-red text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={17} />
                {l.label}
                {l.href === "/admin/produccion" && hayNovedades && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-lgb-red" title="Hay novedades" />
                )}
              </Link>
            );
          })}

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
          <p className="text-white/30 text-xs px-3 mb-2 truncate">{email}</p>
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
