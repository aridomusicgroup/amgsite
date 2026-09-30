// Validación de lo que llega del panel para el catálogo del cotizador.
// Módulo PURO (sin alias ni servidor) para poder probarlo con `npm test`.

export type TipoServicio = "base" | "extra" | "studio";
export const TIPOS_SERVICIO: TipoServicio[] = ["base", "extra", "studio"];

export const PRECIO_MAX = 1_000_000;
/** El paquete "Desde cero" no tiene precio: el cliente arma el suyo servicio por servicio. */
export const BASE_SIN_PRECIO = "scratch";

export interface FilaServicio {
  tipo: TipoServicio;
  id: string;
  activo: boolean;
  datos: Record<string, unknown>;
}

export type Resultado = { ok: true; fila: FilaServicio } | { ok: false; error: string };

const txt = (v: unknown, max: number): string => String(v ?? "").trim().slice(0, max);

/** "Violín Norteño" → "violin-norteno": el id estable de un elemento nuevo. */
export function slug(s: string): string {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const esId = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 40;

/** Texto bilingüe: el español es obligatorio; el inglés, si falta, copia el español. */
function bilingue(v: unknown, campo: string, max = 120): { es: string; en: string } | string {
  const o = (v ?? {}) as { es?: unknown; en?: unknown };
  const es = txt(o.es, max);
  if (!es) return `Falta ${campo} en español.`;
  return { es, en: txt(o.en, max) || es };
}

function precio(v: unknown, permiteCero: boolean): number | string {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "El precio debe ser un número entero, en pesos.";
  if (n < 0 || n > PRECIO_MAX) return `El precio debe estar entre 0 y ${PRECIO_MAX.toLocaleString("es-MX")}.`;
  if (n === 0 && !permiteCero) return "El precio debe ser mayor a 0.";
  return n;
}

function lista(v: unknown, max = 20): string[] {
  return (Array.isArray(v) ? v : []).map((x) => txt(x, 120)).filter(Boolean).slice(0, max);
}

/**
 * Valida un elemento del catálogo.
 *
 * `idsExtras` son los extras que existen (un paquete sólo puede "incluir"
 * extras reales). `idExistente` viene cuando se edita: el id no se toca, porque
 * las plantillas de REAPER y las cotizaciones viejas cuelgan de él.
 */
export function validarServicio(
  tipo: unknown,
  b: Record<string, unknown>,
  idsExtras: ReadonlySet<string>,
  idExistente?: string,
): Resultado {
  if (!TIPOS_SERVICIO.includes(tipo as TipoServicio)) return { ok: false, error: "Tipo inválido." };
  const t = tipo as TipoServicio;

  const nombre = bilingue(t === "base" ? b.name : b.label, "el nombre");
  if (typeof nombre === "string") return { ok: false, error: nombre };

  const id = idExistente ?? slug(nombre.es);
  if (!esId(id)) return { ok: false, error: "No se pudo formar un identificador con ese nombre." };

  const activo = b.activo === undefined ? true : b.activo === true;

  if (t === "extra") {
    const p = precio(b.price, false);
    if (typeof p === "string") return { ok: false, error: p };
    return { ok: true, fila: { tipo: t, id, activo, datos: { label: nombre, price: p, graba: b.graba !== false } } };
  }

  if (t === "studio") {
    const p = precio(b.price, false);
    if (typeof p === "string") return { ok: false, error: p };
    const d = (b.description ?? {}) as { es?: unknown; en?: unknown };
    const des = txt(d.es, 200);
    return {
      ok: true,
      fila: { tipo: t, id, activo, datos: { label: nombre, description: { es: des, en: txt(d.en, 200) || des }, price: p } },
    };
  }

  // Paquete
  const p = precio(b.price, id === BASE_SIN_PRECIO);
  if (typeof p === "string") return { ok: false, error: p };
  const tag = (b.tagline ?? {}) as { es?: unknown; en?: unknown };
  const tagEs = txt(tag.es, 160);
  const inc = (b.includes ?? {}) as { es?: unknown; en?: unknown };
  const incEs = lista(inc.es);
  const incEn = lista(inc.en);

  const includedExtras = [...new Set(lista(b.includedExtras))];
  const fantasma = includedExtras.find((e) => !idsExtras.has(e));
  if (fantasma) return { ok: false, error: `El paquete incluye un instrumento que no existe: "${fantasma}".` };

  const choices: unknown[] = [];
  for (const c of (Array.isArray(b.choices) ? b.choices : []).slice(0, 3)) {
    const x = c as { id?: unknown; label?: unknown; options?: unknown };
    const label = bilingue(x.label, "el título de la opción");
    if (typeof label === "string") return { ok: false, error: label };
    const options: { id: string; label: { es: string; en: string } }[] = [];
    for (const o of (Array.isArray(x.options) ? x.options : []).slice(0, 6)) {
      const oo = o as { id?: unknown; label?: unknown };
      const ol = bilingue(oo.label, "una alternativa", 60);
      if (typeof ol === "string") return { ok: false, error: ol };
      const oid = esId(oo.id) ? oo.id : slug(ol.es);
      if (!esId(oid)) return { ok: false, error: "Una alternativa no tiene un nombre válido." };
      options.push({ id: oid, label: ol });
    }
    if (options.length < 2) return { ok: false, error: `"${label.es}" necesita al menos 2 alternativas.` };
    if (new Set(options.map((o) => o.id)).size !== options.length) return { ok: false, error: `"${label.es}" repite una alternativa.` };
    const cid = esId(x.id) ? x.id : slug(label.es);
    if (!esId(cid)) return { ok: false, error: "Una opción no tiene un nombre válido." };
    choices.push({ id: cid, label, options });
  }

  return {
    ok: true,
    fila: {
      tipo: t, id, activo,
      datos: {
        name: nombre,
        tagline: { es: tagEs, en: txt(tag.en, 160) || tagEs },
        price: p,
        includes: { es: incEs, en: incEn.length === incEs.length ? incEn : incEs },
        includedExtras,
        choices,
      },
    },
  };
}
