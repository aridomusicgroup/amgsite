// Catálogo de módulos del panel + qué puede ver cada rol.
// Sin dependencias de servidor: lo usa tanto el nav (cliente) como los guards.

export interface ModuleDef { href: string; label: string }

export const MODULES: ModuleDef[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/produccion", label: "Producción" },
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/rendimiento", label: "Rendimiento" },
  { href: "/admin/analitica", label: "Analítica" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cotizaciones", label: "Cotizaciones" },
  { href: "/admin/ventas", label: "Ventas" },
  { href: "/admin/beats", label: "Beats" },
  { href: "/admin/cursos", label: "Cursos" },
  { href: "/admin/finanzas", label: "Finanzas" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/importar", label: "Importar" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

const ALL = MODULES.map((m) => m.href);
// Módulos operativos que un admin puede prender/apagar a cualquier usuario.
// (Dinero — Dashboard/Ventas/Finanzas — nunca es opcional: solo admins.)
export const OPCIONALES = ["/admin/marketing", "/admin/analitica", "/admin/pedidos", "/admin/cotizaciones", "/admin/beats", "/admin/clientes", "/admin/importar", "/admin/actividad", "/admin/cursos"];

export interface RoleModules { base: string[]; optional: string[]; defaultOn: string[] }

export const ROLE_MODULES: Record<string, RoleModules> = {
  // El admin ve todo (base, bloqueado).
  admin: { base: ALL, optional: [], defaultOn: [] },
  // Tozi: base bloqueada + opcionales (por defecto prendidos = lo que ya tenía).
  crm: { base: ["/admin/produccion", "/admin/rendimiento", "/admin/ajustes"], optional: OPCIONALES, defaultOn: OPCIONALES },
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
