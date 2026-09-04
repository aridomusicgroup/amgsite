import {
  LayoutDashboard, Package, Wallet, Users, Music2, Receipt, DownloadCloud,
  Megaphone, ClipboardList, BarChart3, TrendingUp, Settings, FileText, History,
  GraduationCap, Terminal, Circle, type LucideIcon,
} from "lucide-react";

/**
 * El icono de cada sección del menú.
 *
 * Vive aparte de `lib/modules.ts` a propósito: ese archivo lo importa
 * `auth-server.ts`, o sea que corre en el camino crítico del login en CADA
 * petición. Meterle dieciséis componentes de lucide-react haría que un error
 * tonto de iconos pueda tumbar la autenticación. El archivo de auth se queda
 * aburrido.
 */
const ICONOS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/produccion": ClipboardList,
  "/admin/actividad": History,
  "/admin/rendimiento": BarChart3,
  "/admin/analitica": TrendingUp,
  "/admin/marketing": Megaphone,
  "/admin/pedidos": Package,
  "/admin/cotizaciones": FileText,
  "/admin/ventas": Receipt,
  "/admin/beats": Music2,
  "/admin/cursos": GraduationCap,
  "/admin/finanzas": Wallet,
  "/admin/clientes": Users,
  "/admin/importar": DownloadCloud,
  "/admin/dev-logs": Terminal,
  "/admin/ajustes": Settings,
};

/** Un módulo nuevo sin icono no rompe el menú: sale con un punto. */
export const moduleIcon = (href: string): LucideIcon => ICONOS[href] ?? Circle;
