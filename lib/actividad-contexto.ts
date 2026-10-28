import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Reg = Record<string, unknown>;

interface Fila {
  proyecto_id: string | null;
  tarea_id: string | null;
  entidad: string | null;
  entidad_id: string | null;
}

/**
 * A qué proyecto y a qué cliente pertenece cada aviso.
 *
 * Se resuelve AL LEER y no al escribir: son ~60 sitios los que registran
 * actividad, y los avisos ya guardados (que también salen en la campanita)
 * quedarían sin contexto para siempre. Así todos —viejos y nuevos— lo traen.
 *
 * En lote: una consulta por tabla para toda la lista, no una por aviso.
 */
export async function conContexto<T extends Fila>(
  sb: SB,
  filas: T[],
): Promise<(T & { proyecto_titulo: string | null; cliente_nombre: string | null })[]> {
  if (!filas.length) return [];

  // Ventas, pagos y pagos a músico cuelgan de una venta: `entidad_id` es la venta.
  const deVenta = (f: Fila) => f.entidad === "venta" || f.entidad === "pago" || f.entidad === "musico";

  // 1) Una tarea sin `proyecto_id` en el aviso: el proyecto sale de la tarea.
  const tareaIds = ids(filas.filter((f) => !f.proyecto_id).map((f) => f.tarea_id ?? (f.entidad === "tarea" ? f.entidad_id : null)));
  const proyDeTarea = new Map<string, string>();
  for (const t of await leer(sb, "proyecto_tareas", "id, proyecto_id", "id", tareaIds)) {
    if (t.proyecto_id) proyDeTarea.set(t.id as string, t.proyecto_id as string);
  }
  const proyectoIdDe = (f: Fila): string | null =>
    f.proyecto_id
    ?? (f.tarea_id ? proyDeTarea.get(f.tarea_id) : null)
    ?? (f.entidad === "proyecto" ? f.entidad_id : null)
    ?? (f.entidad === "tarea" && f.entidad_id ? proyDeTarea.get(f.entidad_id) : null)
    ?? null;

  // 2) Todo lo que se necesita saber, de un jalón y en paralelo.
  const proyIds = ids(filas.map(proyectoIdDe));
  const ventaIds = ids(filas.filter(deVenta).map((f) => f.entidad_id));
  const [proyectos, ventas, proyDeVenta, cotizaciones, contratos] = await Promise.all([
    leer(sb, "proyectos", "id, titulo, contacto_id, venta_id", "id", proyIds),
    leer(sb, "ventas", "id, beat_nombre, contacto_id", "id", ventaIds),
    leer(sb, "proyectos", "titulo, venta_id", "venta_id", ventaIds),
    leer(sb, "cotizaciones", "id, cliente_nombre, contacto_id", "id", ids(filas.filter((f) => f.entidad === "cotizacion").map((f) => f.entidad_id))),
    leer(sb, "contratos", "id, cliente_nombre, contacto_id", "id", ids(filas.filter((f) => f.entidad === "contrato").map((f) => f.entidad_id))),
  ]);

  // 3) Un proyecto sin cliente propio puede tenerlo por su venta.
  const ventaDeProyecto = ids(proyectos.filter((p) => !p.contacto_id).map((p) => p.venta_id));
  const ventasExtra = await leer(sb, "ventas", "id, contacto_id", "id", ventaDeProyecto.filter((v) => !ventaIds.includes(v)));
  const contactoDeVenta = new Map<string, string>();
  for (const v of [...ventas, ...ventasExtra]) if (v.contacto_id) contactoDeVenta.set(v.id as string, v.contacto_id as string);

  const contactoIds = ids([
    ...proyectos.map((p) => p.contacto_id ?? (p.venta_id ? contactoDeVenta.get(p.venta_id as string) : null)),
    ...ventas.map((v) => v.contacto_id),
    ...cotizaciones.filter((c) => !c.cliente_nombre).map((c) => c.contacto_id),
    ...contratos.filter((c) => !c.cliente_nombre).map((c) => c.contacto_id),
    ...filas.filter((f) => f.entidad === "contacto").map((f) => f.entidad_id),
  ]);
  const nombreDe = new Map<string, string>();
  for (const c of await leer(sb, "contactos", "id, nombre", "id", contactoIds)) {
    if (c.nombre) nombreDe.set(c.id as string, c.nombre as string);
  }

  const porId = (rs: Reg[]) => new Map(rs.map((r): [string, Reg] => [r.id as string, r]));
  const proyPorId = porId(proyectos);
  const ventaPorId = porId(ventas);
  const cotPorId = porId(cotizaciones);
  const conPorId = porId(contratos);
  const tituloDeVenta = new Map(proyDeVenta.map((p): [string, string] => [p.venta_id as string, p.titulo as string]));

  return filas.map((f) => {
    let proyecto: string | null = null;
    let cliente: string | null = null;
    const nombre = (contactoId: unknown) => (contactoId ? nombreDe.get(contactoId as string) ?? null : null);

    const proy = proyPorId.get(proyectoIdDe(f) ?? "");
    if (proy) {
      proyecto = (proy.titulo as string) ?? null;
      cliente = nombre(proy.contacto_id ?? (proy.venta_id ? contactoDeVenta.get(proy.venta_id as string) : null));
    } else if (deVenta(f) && f.entidad_id) {
      const venta = ventaPorId.get(f.entidad_id);
      // El proyecto de la venta; si no hay, el nombre con que se vendió.
      proyecto = tituloDeVenta.get(f.entidad_id) ?? (venta?.beat_nombre as string | null) ?? null;
      cliente = nombre(venta?.contacto_id);
    } else if (f.entidad === "cotizacion" && f.entidad_id) {
      const c = cotPorId.get(f.entidad_id);
      cliente = (c?.cliente_nombre as string | null) || nombre(c?.contacto_id);
    } else if (f.entidad === "contrato" && f.entidad_id) {
      const c = conPorId.get(f.entidad_id);
      cliente = (c?.cliente_nombre as string | null) || nombre(c?.contacto_id);
    } else if (f.entidad === "contacto" && f.entidad_id) {
      cliente = nombre(f.entidad_id);
    }
    return { ...f, proyecto_titulo: proyecto, cliente_nombre: cliente };
  });
}

// Los ids que no son uuid (el de un beat es texto) harían fallar TODA la
// consulta de Postgres, no solo ese renglón.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (xs: unknown[]): string[] => [...new Set(xs.filter((x): x is string => typeof x === "string" && UUID.test(x)))];

/** `select` en lote; si falla (tabla o columna ausente) devuelve [] y el aviso sale sin contexto. */
async function leer(sb: SB, tabla: string, columnas: string, columna: string, valores: string[]): Promise<Reg[]> {
  if (!valores.length) return [];
  try {
    const { data } = await sb.from(tabla).select(columnas).in(columna, valores);
    return (data as Reg[] | null) ?? [];
  } catch {
    return [];
  }
}
