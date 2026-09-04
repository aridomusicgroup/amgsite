// Catálogo de módulos del panel + qué puede ver cada rol.
// Sin dependencias de servidor: lo usa tanto el nav (cliente) como los guards.

/** Áreas del panel. Sirven para agrupar la pantalla de accesos: doce interruptores
 *  sueltos no dicen nada; agrupados se lee de un vistazo qué le estás dando. */
export const GRUPOS = ["operacion", "dinero", "contenido", "herramientas"] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<Grupo, string> = {
  operacion: "Operación",
  dinero: "Dinero",
  contenido: "Contenido",
  herramientas: "Herramientas",
};

export const GRUPO_DESC: Record<Grupo, string> = {
  operacion: "El trabajo del día: proyectos, pedidos y clientes.",
  dinero: "Ingresos, gastos y desempeño. Sólo administradores.",
  contenido: "Catálogo, cursos y marketing.",
  herramientas: "Utilidades internas.",
};

export interface ModuleDef {
  href: string;
  label: string;
  grupo: Grupo;
  /** Para qué sirve, en una línea. Se muestra al repartir accesos. */
  desc: string;
}

export const MODULES: ModuleDef[] = [
  { href: "/admin", label: "Dashboard", grupo: "dinero", desc: "Resumen del negocio y sus números." },
  { href: "/admin/produccion", label: "Producción", grupo: "operacion", desc: "Tablero de proyectos y tareas." },
  { href: "/admin/actividad", label: "Actividad", grupo: "operacion", desc: "Quién hizo qué y cuándo." },
  { href: "/admin/rendimiento", label: "Rendimiento", grupo: "operacion", desc: "Carga de trabajo y entregas del equipo." },
  { href: "/admin/analitica", label: "Analítica", grupo: "contenido", desc: "Tráfico y comportamiento del sitio." },
  { href: "/admin/marketing", label: "Marketing", grupo: "contenido", desc: "Campañas y contenido." },
  { href: "/admin/pedidos", label: "Pedidos", grupo: "operacion", desc: "Compras de la tienda y su estado." },
  { href: "/admin/cotizaciones", label: "Cotizaciones", grupo: "operacion", desc: "Cotizaciones y contratos." },
  { href: "/admin/ventas", label: "Ventas", grupo: "dinero", desc: "Ventas, pagos y cobranza." },
  { href: "/admin/beats", label: "Beats", grupo: "contenido", desc: "Catálogo de la tienda." },
  { href: "/admin/cursos", label: "Cursos", grupo: "contenido", desc: "Cursos y sus lecciones." },
  { href: "/admin/finanzas", label: "Finanzas", grupo: "dinero", desc: "Ingresos, egresos y nómina." },
  { href: "/admin/clientes", label: "Clientes", grupo: "operacion", desc: "CRM: contactos y seguimientos." },
  { href: "/admin/importar", label: "Importar", grupo: "herramientas", desc: "Carga masiva desde BeatStars." },
  { href: "/admin/dev-logs", label: "REAPER", grupo: "herramientas", desc: "Dispara renders en la máquina del estudio." },
  { href: "/admin/ajustes", label: "Ajustes", grupo: "herramientas", desc: "Preferencias, equipo y accesos." },
];

const ALL = MODULES.map((m) => m.href);

/**
 * Módulos que un admin puede prender/apagar a cualquier usuario.
 *
 * Fuera quedan a propósito los de DINERO (Dashboard, Ventas, Finanzas): son
 * sólo de administradores y no se reparten. REAPER sí es repartible pero viene
 * apagado — dispara renders en una computadora concreta y entrega tokens de
 * escritura en Drive, así que se da a quien de verdad lo va a operar.
 */
export const OPCIONALES = [
  "/admin/marketing", "/admin/analitica", "/admin/pedidos", "/admin/cotizaciones",
  "/admin/beats", "/admin/clientes", "/admin/importar", "/admin/actividad",
  "/admin/cursos", "/admin/dev-logs",
];

export interface RoleModules { base: string[]; optional: string[]; defaultOn: string[] }

/** Los que vienen prendidos para el rol CRM: todo lo operativo menos REAPER. */
const CRM_DEFAULT = OPCIONALES.filter((h) => h !== "/admin/dev-logs");

export const ROLE_MODULES: Record<string, RoleModules> = {
  // El admin ve todo (base, bloqueado).
  admin: { base: ALL, optional: [], defaultOn: [] },
  // Tozi: base bloqueada + opcionales (por defecto prendidos = lo que ya tenía).
  crm: { base: ["/admin/produccion", "/admin/rendimiento", "/admin/ajustes"], optional: OPCIONALES, defaultOn: CRM_DEFAULT },
  // Diego/Leo: base mínima; los opcionales los prende un admin.
  produccion: { base: ["/admin/produccion", "/admin/rendimiento", "/admin/ajustes"], optional: OPCIONALES, defaultOn: [] },
};

/** Módulos efectivos de un usuario (base + opcionales habilitados), en orden canónico. */
export function effectiveModules(role: string, modulesExtra: string[] | null | undefined): string[] {
  const cfg = ROLE_MODULES[role] ?? ROLE_MODULES.produccion;
  const extras = modulesExtra ?? cfg.defaultOn;
  const set = new Set(cfg.base);
  for (const m of cfg.optional) if (extras.includes(m)) set.add(m);
  return ALL.filter((h) => set.has(h));
}

export const moduleLabel = (href: string) => MODULES.find((m) => m.href === href)?.label ?? href;
export const moduleDef = (href: string) => MODULES.find((m) => m.href === href);
