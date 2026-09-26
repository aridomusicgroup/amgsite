// Ficha editable de cada beat: la "capa encima" del catálogo.
//
// El catálogo sale de dos fuentes (data/beats-beatstars.json y la tabla
// `beats`). Lo que se edita desde el panel NO toca ninguna de las dos: vive en
// `beat_ficha`, una fila por beat, y aquí se aplica encima. Columna en null =
// "usa lo de siempre", así que restablecer un campo es borrarlo.
//
// Módulo PURO (sin `@/`, sin base de datos): lo importan el catálogo, las APIs,
// el navegador y las pruebas de `node --test`.

export const LICENCIAS = ["basic", "premium", "premium-plus", "exclusive"] as const;
export type LicenciaId = (typeof LICENCIAS)[number];

export type ExclusivaModo = "directa" | "negociar";

/** La fila de `beat_ficha` tal como vive en la base. */
export interface FichaRow {
  beat_id: string;
  bpm: number | null;
  tonalidad: string | null;
  genero: string | null;
  artistas: string[] | null;
  mood: string | null;
  tags: string[] | null;
  descripcion: string | null;
  precios: Partial<Record<LicenciaId, number>> | null;
  exclusiva_modo: ExclusivaModo | null;
  portada_url: string | null;
  portada_chica_url: string | null;
  oculto: boolean;
  destacado: boolean;
  notas: string | null;
  actualizado_por: string | null;
  updated_at: string | null;
}

/** Los campos que la ficha puede pisar de un beat del catálogo. */
export interface BeatEditable {
  bpm: number;
  key: string;
  genre: string;
  artists: string[];
  mood: string;
  tags: string[];
  artworkUrl: string | null;
  artworkLarge: string | null;
}

export interface ExtrasFicha {
  descripcion: string | null;
  destacado: boolean;
}

const lleno = (s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== "";

/**
 * Aplica la ficha encima de un beat. Devuelve un objeto NUEVO: el beat de
 * entrada (que puede venir del caché del catálogo) no se toca.
 */
export function aplicarFicha<T extends BeatEditable>(beat: T, ficha: FichaRow | null | undefined): T & ExtrasFicha {
  if (!ficha) return { ...beat, descripcion: null, destacado: false };
  const chica = ficha.portada_chica_url || ficha.portada_url;
  const grande = ficha.portada_url || ficha.portada_chica_url;
  return {
    ...beat,
    bpm: ficha.bpm && ficha.bpm > 0 ? ficha.bpm : beat.bpm,
    key: lleno(ficha.tonalidad) ? ficha.tonalidad : beat.key,
    genre: lleno(ficha.genero) ? ficha.genero : beat.genre,
    artists: ficha.artistas && ficha.artistas.length ? [...ficha.artistas] : beat.artists,
    mood: lleno(ficha.mood) ? ficha.mood : beat.mood,
    tags: ficha.tags && ficha.tags.length ? [...ficha.tags] : beat.tags,
    artworkUrl: chica || beat.artworkUrl,
    artworkLarge: grande || beat.artworkLarge,
    descripcion: lleno(ficha.descripcion) ? ficha.descripcion : null,
    destacado: Boolean(ficha.destacado),
  };
}

// ─── Precios ────────────────────────────────────────────────────────────────

export type PreciosEfectivos = Record<LicenciaId, number | null>;

export interface EntradaPrecios {
  /** Precios globales de data/licenses.json (la exclusiva viene en null). */
  globales: Partial<Record<LicenciaId, number | null>>;
  ajuste: FichaRow["precios"] | null | undefined;
  modo: ExclusivaModo | null | undefined;
  /** ¿Está en data/legacy-beats.json? (su exclusiva se negocia por defecto) */
  esLegacy: boolean;
  /** Precio de la exclusiva directa cuando el beat no trae ajuste. */
  exclusivaDirecta: number;
}

/** ¿La exclusiva de este beat se compra en el sitio? */
export function exclusivaEsDirecta(modo: ExclusivaModo | null | undefined, esLegacy: boolean): boolean {
  if (modo === "directa") return true;
  if (modo === "negociar") return false;
  return !esLegacy;
}

/**
 * Lo que cuesta cada licencia de ESTE beat. Es lo que muestra la tienda y lo
 * que cobra el checkout; `exclusive: null` = se negocia, no se vende aquí.
 */
export function preciosEfectivos(e: EntradaPrecios): PreciosEfectivos {
  const ajuste = e.ajuste ?? {};
  const out = {} as PreciosEfectivos;
  for (const id of LICENCIAS) {
    if (id === "exclusive") continue;
    const a = ajuste[id];
    out[id] = typeof a === "number" && a > 0 ? a : e.globales[id] ?? null;
  }
  const directa = exclusivaEsDirecta(e.modo, e.esLegacy);
  const ae = ajuste.exclusive;
  out.exclusive = directa ? (typeof ae === "number" && ae > 0 ? ae : e.exclusivaDirecta) : null;
  return out;
}

/**
 * Avisos (no errores) cuando la escalera de precios queda al revés: una
 * licencia que trae MÁS archivos no debería costar menos que una con menos.
 */
export function avisosDePrecios(p: PreciosEfectivos): string[] {
  const out: string[] = [];
  const orden: [LicenciaId, string][] = [
    ["basic", "Basic"], ["premium", "Premium"], ["premium-plus", "Premium Plus"], ["exclusive", "Exclusiva"],
  ];
  for (let i = 1; i < orden.length; i++) {
    const [id, nombre] = orden[i];
    const [idAnt, nombreAnt] = orden[i - 1];
    const v = p[id];
    const ant = p[idAnt];
    if (v != null && ant != null && v <= ant) out.push(`${nombre} ($${v}) no cuesta más que ${nombreAnt} ($${ant}).`);
  }
  return out;
}

// ─── Validación de lo que llega del panel ───────────────────────────────────

export const PRECIO_MIN = 1;
export const PRECIO_MAX = 10000;
export const BPM_MIN = 40;
export const BPM_MAX = 300;
export const MAX_TAGS = 15;
export const MAX_ARTISTAS = 8;
export const MAX_DESCRIPCION = 600;
export const MAX_NOTAS = 1000;

/** Tonalidades que ofrece el selector (misma escritura que formatKey). */
export const TONALIDADES = [
  "C", "Cm", "C#", "C#m", "D", "Dm", "D#", "D#m", "Eb", "Ebm", "E", "Em",
  "F", "Fm", "F#", "F#m", "G", "Gm", "G#", "G#m", "Ab", "Abm", "A", "Am",
  "A#", "A#m", "Bb", "Bbm", "B", "Bm",
] as const;

const RE_TONALIDAD = /^[A-G][#b]?m?$/;

export type CambiosFicha = Partial<Omit<FichaRow, "beat_id" | "actualizado_por" | "updated_at">>;

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const texto = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

const lista = (v: unknown, maxItems: number, maxLargo: number, minusculas: boolean): string[] | null => {
  const crudo = Array.isArray(v) ? v : String(v ?? "").split(",");
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const x of crudo) {
    let s = String(x ?? "").replace(/\s+/g, " ").trim().slice(0, maxLargo);
    if (minusculas) s = s.toLowerCase();
    const k = s.toLowerCase();
    if (!s || vistos.has(k)) continue;
    vistos.add(k);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : null;
};

/** Valida los ajustes de precio. `null`/"" en una licencia = quitar el ajuste. */
export function validarPrecios(input: unknown): Resultado<Partial<Record<LicenciaId, number>> | null> {
  if (input == null || input === "") return { ok: true, valor: null };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Precios inválidos." };
  const out: Partial<Record<LicenciaId, number>> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(LICENCIAS as readonly string[]).includes(k)) return { ok: false, error: `Licencia desconocida: ${k}` };
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < PRECIO_MIN || n > PRECIO_MAX) {
      return { ok: false, error: `El precio debe estar entre $${PRECIO_MIN} y $${PRECIO_MAX} USD.` };
    }
    out[k as LicenciaId] = Math.round(n * 100) / 100;
  }
  return { ok: true, valor: Object.keys(out).length ? out : null };
}

/**
 * Lista blanca de lo que el panel puede cambiar. Sólo se toca lo que viene en
 * el cuerpo; lo demás se queda como está.
 */
export function validarFicha(input: unknown): Resultado<CambiosFicha> {
  if (!input || typeof input !== "object") return { ok: false, error: "Petición inválida." };
  const b = input as Record<string, unknown>;
  const c: CambiosFicha = {};

  if ("bpm" in b) {
    if (b.bpm == null || b.bpm === "" || Number(b.bpm) === 0) c.bpm = null;
    else {
      const n = Math.round(Number(b.bpm));
      if (!Number.isFinite(n) || n < BPM_MIN || n > BPM_MAX) {
        return { ok: false, error: `El BPM debe estar entre ${BPM_MIN} y ${BPM_MAX}.` };
      }
      c.bpm = n;
    }
  }
  if ("tonalidad" in b) {
    const t = texto(b.tonalidad, 8);
    if (t && !RE_TONALIDAD.test(t)) return { ok: false, error: "Tonalidad inválida (ej. D#m, Eb, G)." };
    c.tonalidad = t;
  }
  if ("genero" in b) c.genero = texto(b.genero, 40);
  if ("mood" in b) c.mood = texto(b.mood, 30);
  if ("descripcion" in b) c.descripcion = texto(b.descripcion, MAX_DESCRIPCION);
  if ("notas" in b) {
    // Las notas conservan los saltos de línea.
    const s = String(b.notas ?? "").trim();
    c.notas = s ? s.slice(0, MAX_NOTAS) : null;
  }
  if ("artistas" in b) c.artistas = lista(b.artistas, MAX_ARTISTAS, 40, false);
  if ("tags" in b) c.tags = lista(b.tags, MAX_TAGS, 30, true);
  if ("oculto" in b) c.oculto = b.oculto === true;
  if ("destacado" in b) c.destacado = b.destacado === true;
  if ("exclusiva_modo" in b) {
    const m = b.exclusiva_modo;
    if (m !== null && m !== "" && m !== "directa" && m !== "negociar") {
      return { ok: false, error: "Modo de exclusiva inválido." };
    }
    c.exclusiva_modo = m === "directa" || m === "negociar" ? m : null;
  }
  if ("precios" in b) {
    const p = validarPrecios(b.precios);
    if (!p.ok) return p;
    c.precios = p.valor;
  }

  if (Object.keys(c).length === 0) return { ok: false, error: "No hay nada que guardar." };
  return { ok: true, valor: c };
}

/** Ficha vacía (todo "lo de siempre") para un beat que aún no tiene fila. */
export function fichaVacia(beatId: string): FichaRow {
  return {
    beat_id: beatId, bpm: null, tonalidad: null, genero: null, artistas: null, mood: null,
    tags: null, descripcion: null, precios: null, exclusiva_modo: null, portada_url: null,
    portada_chica_url: null, oculto: false, destacado: false, notas: null,
    actualizado_por: null, updated_at: null,
  };
}

/** Describe un cambio de precio para la bitácora: "Premium de $50 a $70". */
export function describirCambioPrecios(antes: PreciosEfectivos, despues: PreciosEfectivos): string[] {
  const nombre: Record<LicenciaId, string> = {
    basic: "Basic", premium: "Premium", "premium-plus": "Premium Plus", exclusive: "Exclusiva",
  };
  const fmt = (v: number | null) => (v == null ? "negociable" : `$${v}`);
  return LICENCIAS.filter((id) => antes[id] !== despues[id]).map(
    (id) => `${nombre[id]} de ${fmt(antes[id])} a ${fmt(despues[id])}`,
  );
}

// ─── Promoción: links de videos y reels ─────────────────────────────────────

export type Canal = "youtube" | "instagram" | "tiktok" | "facebook" | "otro";

/** Normaliza un link pegado: sólo http(s), sin espacios. null = no es un link. */
export function limpiarUrl(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s || s.length > 500) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** De qué red es un link, por su dominio. */
export function canalDeUrl(url: string): Canal {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return "otro";
  }
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return "facebook";
  return "otro";
}

/** El id de un video de YouTube (watch, youtu.be, shorts, embed). null si no hay. */
export function idYoutube(url: string | null | undefined): string | null {
  if (!url || canalDeUrl(url) !== "youtube") return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host.endsWith("youtu.be")) id = u.pathname.split("/")[1] ?? null;
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
