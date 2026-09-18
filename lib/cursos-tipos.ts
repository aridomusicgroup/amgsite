/**
 * Vocabulario y lógica PURA de Cursos (sin servidor ni navegador): la usan el
 * editor del admin, las notas que ve el alumno y las rutas de API que validan
 * lo que llega. Una sola lista de etiquetas, rutas y campos de guion para que
 * las tres partes no se desincronicen.
 */

export type TipoLeccion = "video" | "pdf" | "link" | "tab" | "quiz" | "entrega" | "texto" | "en_vivo";
export type Etiqueta = "nucleo" | "capsula" | "filosofia" | "herramienta" | "profunda" | "evaluacion";
export type Ruta = "principal" | "profunda" | "evaluacion" | "bonus";
export type Cta = "ninguno" | "revision" | "mentoria" | "estudio" | "whatsapp";
export type EstadoProduccion = "guion" | "listo_grabar" | "grabado" | "editado";
export type EstadoMentoria = "oculta" | "lista_espera" | "abierta";
export type TipoCurso = "curso" | "mentoria";

export const TIPOS_LECCION: readonly TipoLeccion[] = ["video", "pdf", "link", "tab", "quiz", "entrega", "texto", "en_vivo"];
export const TIPO_LABEL: Record<TipoLeccion, string> = {
  video: "Video",
  pdf: "PDF",
  link: "Enlace",
  tab: "Tablatura",
  quiz: "Quiz",
  entrega: "Entrega",
  texto: "Texto",
  en_vivo: "En vivo",
};
/** Tipos cuyo material es un archivo de Drive servido por el proxy. */
export const TIPOS_CON_ARCHIVO: readonly TipoLeccion[] = ["video", "pdf", "tab", "en_vivo"];

export interface EtiquetaDef { id: Etiqueta; label: string; emoji: string; desc: string }
export const ETIQUETAS: readonly EtiquetaDef[] = [
  { id: "nucleo", label: "Núcleo", emoji: "🎸", desc: "Ruta principal: cuenta para el avance" },
  { id: "herramienta", label: "Herramienta", emoji: "🔧", desc: "Capo, 0.5x, IA: ruta principal" },
  { id: "filosofia", label: "Filosofía", emoji: "🧭", desc: "Cierre corto de módulo: ruta principal" },
  { id: "capsula", label: "Dato Crack", emoji: "⚡", desc: "Cápsula vertical de 30–45 s, siempre opcional" },
  { id: "profunda", label: "Profunda", emoji: "📚", desc: "Teoría a fondo: ruta optativa" },
  { id: "evaluacion", label: "Evaluación", emoji: "🏆", desc: "Quiz o entrega: ruta optativa" },
];
export const ETIQUETA_DE = Object.fromEntries(ETIQUETAS.map((e) => [e.id, e])) as Record<Etiqueta, EtiquetaDef>;

export const RUTAS: readonly { id: Ruta; label: string }[] = [
  { id: "principal", label: "Ruta principal" },
  { id: "profunda", label: "Ruta profunda (optativa)" },
  { id: "evaluacion", label: "Evaluaciones (optativa)" },
  { id: "bonus", label: "Bonus" },
];

export const CTAS: readonly { id: Cta; label: string }[] = [
  { id: "ninguno", label: "Sin llamado" },
  { id: "revision", label: "Revisión personal" },
  { id: "mentoria", label: "Mentoría grupal" },
  { id: "estudio", label: "Grabar en el estudio" },
  { id: "whatsapp", label: "Escríbenos por WhatsApp" },
];

export const ESTADOS_PRODUCCION: readonly { id: EstadoProduccion; label: string }[] = [
  { id: "guion", label: "Guion pendiente" },
  { id: "listo_grabar", label: "Listo para grabar" },
  { id: "grabado", label: "Grabado" },
  { id: "editado", label: "Editado" },
];

export const esUno = <T extends string>(lista: readonly T[] | readonly { id: T }[], v: unknown): v is T =>
  typeof v === "string" && (lista as readonly (T | { id: T })[]).some((x) => (typeof x === "string" ? x : x.id) === v);

// ── Guion (la plantilla [RELLENAR]) ─────────────────────────────────────────

export interface CampoGuion { key: string; label: string; ayuda: string }

const NUCLEO: CampoGuion[] = [
  { key: "objetivo", label: "Objetivo", ayuda: "“Al terminar podrás…”: algo medible, con tempo meta." },
  { key: "gancho", label: "Gancho (0:00–0:30)", ayuda: "Toca primero el resultado final de la lección." },
  { key: "minimo", label: "Lo mínimo (≤ 3 min)", ayuda: "Sólo la teoría necesaria para tocar esto: 1 a 3 ideas y una analogía tuya." },
  { key: "practica", label: "Manos a la obra", ayuda: "Pasos, digitación, lento → 0.5x → tempo real. Tempo inicial → tempo meta." },
  { key: "criterio", label: "Criterio", ayuda: "Cuándo sí, cuándo no, por qué suena a corrido. Rola de ejemplo y error común." },
  { key: "reto", label: "Reto", ayuda: "Tarea medible: tempo, repeticiones, grabarse." },
  { key: "puente", label: "Puente (10 s)", ayuda: "Adelanto de la siguiente lección para dejar la curiosidad abierta." },
];

export const CAMPOS_GUION: Record<"nucleo" | "capsula" | "filosofia" | "evaluacion", CampoGuion[]> = {
  nucleo: NUCLEO,
  capsula: [
    { key: "dato", label: "Dato (gancho de 5 s)", ayuda: "La frase que detiene el scroll." },
    { key: "explicacion", label: "Explicación (25 s)", ayuda: "El porqué, sin fórmulas: una imagen o una analogía." },
    { key: "aplicacion", label: "¿Y eso qué? (10 s)", ayuda: "Cómo le sirve al tocar mañana." },
    { key: "fuente", label: "Fuente", ayuda: "Dónde se verifica el dato (no se muestra al alumno)." },
  ],
  filosofia: [
    { key: "idea", label: "La idea", ayuda: "El principio en una frase." },
    { key: "historia_personal", label: "Tu historia", ayuda: "Una anécdota real tuya que lo demuestre." },
    { key: "pregunta_al_alumno", label: "Pregunta para el alumno", ayuda: "Algo que se quede pensando hasta la siguiente práctica." },
  ],
  evaluacion: [
    { key: "instrucciones", label: "Instrucciones", ayuda: "Qué tiene que hacer, paso a paso." },
    { key: "entregables", label: "Qué entrega", ayuda: "Video, audio, tablatura, texto…" },
  ],
};

/** Campos del guion que NO se le muestran al alumno (notas internas). */
export const CAMPOS_INTERNOS = new Set(["fuente"]);

export function camposDeEtiqueta(etiqueta: Etiqueta): CampoGuion[] {
  if (etiqueta === "capsula" || etiqueta === "filosofia" || etiqueta === "evaluacion") return CAMPOS_GUION[etiqueta];
  return CAMPOS_GUION.nucleo;
}

/** true si el texto sigue siendo plantilla (vacío o con [RELLENAR…]). */
export const esRellenar = (s: unknown): boolean =>
  typeof s !== "string" || !s.trim() || /\[RELLENAR/i.test(s);

/** "[RELLENAR: toca la intro]" → "toca la intro" (la indicación de la plantilla). */
export const indicacion = (v: unknown): string =>
  typeof v === "string" ? v.replace(/^\s*\[RELLENAR:?\s*/i, "").replace(/\]\s*$/, "").trim() : "";

/** Los campos del guion ya escritos, en orden, listos para mostrárselos al alumno. */
export function camposVisibles(contenido: Record<string, unknown> | null | undefined, etiqueta: Etiqueta): { label: string; texto: string }[] {
  const c = contenido ?? {};
  return camposDeEtiqueta(etiqueta)
    .filter((f) => !CAMPOS_INTERNOS.has(f.key) && !esRellenar(c[f.key]))
    .map((f) => ({ label: f.label.replace(/\s*\(.*\)$/, ""), texto: String(c[f.key]).trim() }));
}

/** Cuántos campos del guion faltan por escribir (para el resumen de producción). */
export function camposPendientes(contenido: Record<string, unknown> | null | undefined, etiqueta: Etiqueta): number {
  const c = contenido ?? {};
  return camposDeEtiqueta(etiqueta).filter((f) => esRellenar(c[f.key])).length;
}

// ── Capítulos del video ─────────────────────────────────────────────────────

export interface Marcador { t: number; label: string }

/** "1:05" → 65, "1:02:03" → 3723. null si no es un tiempo. */
export function aSegundos(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] != null ? Number(m[3]) : null];
  if (b > 59 || (c != null && c > 59)) return null;
  return c == null ? a * 60 + b : a * 3600 + b * 60 + c;
}

export function formatoTiempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Un capítulo por renglón: "0:45 Rasgueo base" o "0:45 - Rasgueo base". */
export function parseMarcadores(texto: string): Marcador[] {
  const out: Marcador[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)$/);
    if (!m) continue;
    const t = aSegundos(m[1]);
    const label = m[2].trim().slice(0, 120);
    if (t != null && label) out.push({ t, label });
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 60);
}

export const marcadoresATexto = (ms: Marcador[]): string => ms.map((m) => `${formatoTiempo(m.t)} ${m.label}`).join("\n");

export function validarMarcadores(x: unknown): Marcador[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((m): m is { t: unknown; label: unknown } => typeof m === "object" && m !== null)
    .map((m) => ({ t: Math.floor(Number(m.t)), label: String(m.label ?? "").trim().slice(0, 120) }))
    .filter((m) => Number.isFinite(m.t) && m.t >= 0 && m.label)
    .sort((a, b) => a.t - b.t)
    .slice(0, 60);
}

// ── Recursos descargables ───────────────────────────────────────────────────

export type TipoRecurso = "pdf" | "audio" | "gp" | "otro";
export interface Recurso { titulo: string; drive_file_id: string; tipo: TipoRecurso }

export function validarRecursos(x: unknown): Recurso[] {
  if (!Array.isArray(x)) return [];
  const tipos: TipoRecurso[] = ["pdf", "audio", "gp", "otro"];
  return x
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      titulo: String(r.titulo ?? "").trim().slice(0, 120),
      drive_file_id: String(r.drive_file_id ?? "").trim(),
      tipo: (tipos.includes(r.tipo as TipoRecurso) ? r.tipo : "otro") as TipoRecurso,
    }))
    .filter((r) => r.titulo && /^[A-Za-z0-9_-]{10,}$/.test(r.drive_file_id))
    .slice(0, 20);
}

// ── Quiz y rúbrica ──────────────────────────────────────────────────────────

export interface PreguntaQuiz {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  /** Índice de un recurso de audio de la lección (preguntas de oído). */
  audio?: number;
}

/** Diagnóstico: en vez de aprobar/reprobar, cada rango de puntaje recomienda una ruta. */
export interface RangoDiagnostico { min: number; texto: string }

export const APROBAR_QUIZ_PCT = 70;

export function validarQuiz(x: unknown): PreguntaQuiz[] {
  if (!Array.isArray(x)) return [];
  const out: PreguntaQuiz[] = [];
  for (const p of x.slice(0, 40)) {
    if (typeof p !== "object" || p === null) continue;
    const q = p as Record<string, unknown>;
    const pregunta = String(q.pregunta ?? "").trim().slice(0, 500);
    const opciones = Array.isArray(q.opciones)
      ? q.opciones.map((o) => String(o ?? "").trim().slice(0, 200)).filter(Boolean).slice(0, 6)
      : [];
    const correcta = Math.floor(Number(q.correcta));
    if (!pregunta || opciones.length < 2 || !(correcta >= 0 && correcta < opciones.length)) continue;
    const item: PreguntaQuiz = { pregunta, opciones, correcta };
    const explicacion = String(q.explicacion ?? "").trim().slice(0, 800);
    if (explicacion) item.explicacion = explicacion;
    const audio = Math.floor(Number(q.audio));
    if (q.audio != null && q.audio !== "" && audio >= 0 && audio < 20) item.audio = audio;
    out.push(item);
  }
  return out;
}

export function validarDiagnostico(x: unknown): RangoDiagnostico[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({ min: Math.max(0, Math.min(100, Math.floor(Number(r.min) || 0))), texto: String(r.texto ?? "").trim().slice(0, 600) }))
    .filter((r) => r.texto)
    .sort((a, b) => a.min - b.min)
    .slice(0, 6);
}

export interface ResultadoQuiz { correctas: number; total: number; pct: number; aprobado: boolean }

export function puntajeQuiz(preguntas: PreguntaQuiz[], respuestas: unknown[]): ResultadoQuiz {
  const total = preguntas.length;
  const correctas = preguntas.reduce((n, p, i) => n + (Number(respuestas[i]) === p.correcta ? 1 : 0), 0);
  const pct = total ? Math.round((correctas / total) * 100) : 0;
  return { correctas, total, pct, aprobado: total > 0 && pct >= APROBAR_QUIZ_PCT };
}

/** El texto del rango más alto que alcanzó el puntaje (diagnóstico). */
export function recomendacionDiagnostico(rangos: RangoDiagnostico[], pct: number): string | null {
  let texto: string | null = null;
  for (const r of rangos) if (pct >= r.min) texto = r.texto;
  return texto;
}

export interface CriterioRubrica { criterio: string; niveles: string[] }
export const NIVELES_RUBRICA = ["En camino", "Suficiente", "Sólido", "Profesional"] as const;

export function validarRubrica(x: unknown): CriterioRubrica[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      criterio: String(r.criterio ?? "").trim().slice(0, 120),
      niveles: Array.isArray(r.niveles) ? r.niveles.map((n) => String(n ?? "").trim().slice(0, 300)).slice(0, 4) : [],
    }))
    .filter((r) => r.criterio)
    .slice(0, 10);
}

/** { "Tempo y pulso": 3, ... } con niveles 1–4 y sólo criterios que existen. */
export function validarCalificacion(x: unknown, rubrica: CriterioRubrica[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof x !== "object" || x === null) return out;
  const validos = new Set(rubrica.map((r) => r.criterio));
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const n = Math.floor(Number(v));
    if (validos.has(k) && n >= 1 && n <= 4) out[k] = n;
  }
  return out;
}

// ── Contenido completo de una lección (lo que se guarda en `contenido`) ─────

const MAX_TEXTO = 8000;
const CAMPOS_TEXTO = new Set(
  [...Object.values(CAMPOS_GUION).flat().map((c) => c.key), "cta_texto", "notas_grabacion"],
);

/**
 * Limpia lo que llega del editor antes de guardarlo: sólo claves conocidas,
 * textos con tope y estructuras validadas. Nada de JSON arbitrario en la base.
 */
export function sanitizarContenido(x: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof x !== "object" || x === null) return out;
  const c = x as Record<string, unknown>;
  for (const k of CAMPOS_TEXTO) {
    if (typeof c[k] === "string") out[k] = (c[k] as string).slice(0, MAX_TEXTO);
  }
  if ("preguntas" in c) out.preguntas = validarQuiz(c.preguntas);
  if ("diagnostico" in c) out.diagnostico = validarDiagnostico(c.diagnostico);
  if ("rubrica" in c) out.rubrica = validarRubrica(c.rubrica);
  if (typeof c.fecha_hora === "string" && !Number.isNaN(Date.parse(c.fecha_hora))) out.fecha_hora = new Date(c.fecha_hora).toISOString();
  if ("duracion_min" in c) {
    const d = Math.floor(Number(c.duracion_min));
    if (d > 0 && d <= 600) out.duracion_min = d;
  }
  return out;
}

// ── Bitácora de práctica ────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const aDia = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);

/** "YYYY-MM-DD" de una fecha en la zona de México (donde practica el alumno). */
export function hoyMx(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(ahora);
}

/**
 * Días seguidos con práctica registrada. Cuenta hacia atrás desde hoy; si hoy
 * todavía no practicó, la racha de ayer sigue viva (no se rompe a medianoche).
 */
export function calcularRacha(fechas: string[], hoy: string): number {
  const dias = new Set(fechas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).map(aDia));
  let cursor = aDia(hoy);
  if (!dias.has(cursor)) cursor -= DIA_MS;
  let racha = 0;
  while (dias.has(cursor)) {
    racha++;
    cursor -= DIA_MS;
  }
  return racha;
}

/** Minutos de los últimos 7 días (hoy incluido). */
export function minutosSemana(registros: { fecha: string; minutos: number }[], hoy: string): number {
  const fin = aDia(hoy);
  const inicio = fin - 6 * DIA_MS;
  return registros.reduce((a, r) => {
    const d = aDia(r.fecha);
    return d >= inicio && d <= fin ? a + (Number(r.minutos) || 0) : a;
  }, 0);
}

// ── Accesos con vencimiento (mentoría) ──────────────────────────────────────

export const accesoVigente = (venceEn: string | null | undefined, ahora: Date = new Date()): boolean =>
  !venceEn || Date.parse(venceEn) > ahora.getTime();

/** +N meses contados desde lo que sea más tarde: hoy o el vencimiento actual. */
export function extenderVencimiento(actual: string | null | undefined, ahora: Date = new Date(), meses = 1): string {
  const base = actual && Date.parse(actual) > ahora.getTime() ? new Date(actual) : new Date(ahora);
  const dia = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(dia, ultimo)); // 31-ene + 1 mes = 28/29-feb, no 3-mar
  return base.toISOString();
}

// ── Entregas ────────────────────────────────────────────────────────────────

export const FORMATOS_ENTREGA: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};
export const MAX_ENTREGA_BYTES = 1024 * 1024 * 1024; // 1 GB

export function extension(nombre: string): string {
  const m = nombre.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "";
}

export const esFormatoEntrega = (nombre: string): boolean => extension(nombre) in FORMATOS_ENTREGA;

// ── Configuración del curso ─────────────────────────────────────────────────

export interface ConfigMentoria { estado: EstadoMentoria; curso_id: string | null; precio_mes: number | null }
/** Textos de la página de venta (/cursos/<slug>). Lo vacío o con [RELLENAR] no se muestra. */
export interface ConfigLanding {
  promesa: string;
  /** Un punto por renglón. */
  para_quien: string;
  no_para_quien: string;
  garantia: string;
  /** Pares “P: … / R: …” separados por un renglón en blanco. */
  faqs: string;
}
export const CAMPOS_LANDING: { key: keyof ConfigLanding; label: string; ayuda: string }[] = [
  { key: "promesa", label: "Promesa", ayuda: "Qué va a poder hacer el alumno al terminar, en una o dos frases." },
  { key: "para_quien", label: "Para quién sí (uno por renglón)", ayuda: "Ej. Ya tienes docerola y quieres tocar corridos tumbados de verdad" },
  { key: "no_para_quien", label: "Para quién no (uno por renglón)", ayuda: "Ej. Buscas tocar sin practicar" },
  { key: "garantia", label: "Garantía / política de reembolso", ayuda: "Qué pasa si no le sirve. Revísala con el abogado." },
  { key: "faqs", label: "Preguntas frecuentes", ayuda: "P: ¿Necesito saber leer partitura?\nR: No, es una ruta opcional.\n\nP: …" },
];

export interface ConfigCurso {
  mentoria: ConfigMentoria;
  landing: ConfigLanding;
  preventa: ConfigPreventa;
  /** Textos de los llamados por tipo; si falta, se usa el de fábrica. */
  cta_textos: Partial<Record<Cta, string>>;
  meta_semanal_min: number;
  whatsapp_texto: string | null;
}

export const CTA_TEXTO_DEFAULT: Record<Exclude<Cta, "ninguno">, string> = {
  revision: "La cámara no miente, pero tampoco te corrige. Sube tu video y te decimos exactamente qué ajustar.",
  mentoria: "Cada semana nos juntamos en vivo a corregir vicios, sacar rolas y revisar arreglos. Aparta tu lugar.",
  estudio: "¿Ya tienes tu arreglo? Grábalo en serio en el estudio de ARIDO, con precio de alumno.",
  whatsapp: "¿Te atoraste? Escríbenos y te echamos la mano.",
};

function leerLanding(x: unknown): ConfigLanding {
  const l = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const t = (k: string, max: number) => (typeof l[k] === "string" ? (l[k] as string).slice(0, max) : "");
  return {
    promesa: t("promesa", 600),
    para_quien: t("para_quien", 2000),
    no_para_quien: t("no_para_quien", 2000),
    garantia: t("garantia", 1500),
    faqs: t("faqs", 8000),
  };
}

/** Las preguntas frecuentes escritas como “P: … / R: …”. */
export function parseFaqs(texto: string): { p: string; r: string }[] {
  return texto
    .split(/\r?\n\s*\r?\n/)
    .map((bloque) => {
      const m = bloque.trim().match(/^P:\s*([\s\S]+?)\r?\nR:\s*([\s\S]+)$/i);
      return m ? { p: m[1].trim(), r: m[2].trim() } : null;
    })
    .filter((x): x is { p: string; r: string } => Boolean(x && x.p && x.r && !esRellenar(x.p) && !esRellenar(x.r)));
}

/** Renglones no vacíos (y no plantilla) de un texto. */
export const renglones = (t: string): string[] =>
  t.split(/\r?\n/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter((x) => x && !esRellenar(x));

// ── Preventa ────────────────────────────────────────────────────────────────

/**
 * El curso se vende con descuento mientras se graba. `activa` = todavía no se
 * lanza: quien compra aparta su lugar pero no ve lecciones hasta el lanzamiento.
 * Cupo y cierre son opcionales; al llenarse o pasar la fecha la preventa se
 * cierra sola (ya no vende) y al lanzar se cobra el precio normal.
 */
export interface ConfigPreventa {
  activa: boolean;
  /** Precio fundador (MXN). */
  precio: number | null;
  /** Último día para comprar en preventa (YYYY-MM-DD, hora de México). */
  cierre: string | null;
  /** Lugares de fundador; null = sin límite. */
  cupo: number | null;
  /** Texto libre: “noviembre 2026”. */
  lanzamiento: string;
  /** Un bono por renglón. */
  bonos: string;
}

const FECHA_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function leerPreventa(x: unknown): ConfigPreventa {
  const p = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const precio = Number(p.precio);
  const cupo = Math.floor(Number(p.cupo));
  const cierre = typeof p.cierre === "string" && FECHA_YMD.test(p.cierre) && !Number.isNaN(aDia(p.cierre)) ? p.cierre : null;
  return {
    activa: p.activa === true,
    precio: Number.isFinite(precio) && precio > 0 ? Math.round(precio * 100) / 100 : null,
    cierre,
    cupo: cupo > 0 && cupo <= 100_000 ? cupo : null,
    lanzamiento: typeof p.lanzamiento === "string" ? p.lanzamiento.trim().slice(0, 80) : "",
    bonos: typeof p.bonos === "string" ? p.bonos.slice(0, 1500) : "",
  };
}

/** Error de captura de la preventa, o null si está bien. */
export function validarPreventa(p: ConfigPreventa, precioRegular: number | null): string | null {
  if (p.precio && precioRegular && p.precio >= precioRegular) {
    return `El precio de preventa tiene que ser menor al regular ($${precioRegular.toLocaleString("es-MX")}).`;
  }
  return null;
}

export type EstadoVenta = "oculto" | "preventa" | "preventa_cerrada" | "venta";

export interface Venta {
  estado: EstadoVenta;
  /** Lo que cobra el checkout; null = no se vende en línea (cerrado o sólo WhatsApp). */
  precio: number | null;
  /** El precio normal, el que se cobra al lanzar (se tacha en la preventa). */
  precioRegular: number | null;
  cupo: number | null;
  /** Lugares que quedan (sólo con cupo). */
  quedan: number | null;
  /** Días para el cierre; 0 = hoy es el último día. */
  diasParaCierre: number | null;
  motivoCierre: "fecha" | "cupo" | "sin_precio" | null;
  lanzamiento: string;
}

/**
 * La ÚNICA regla de precio de un curso: la usan la página de venta, el inicio,
 * el checkout y el panel. `vendidos` = lugares ya vendidos (accesos por venta).
 */
export function estadoVenta(d: { activo: boolean; preventa: ConfigPreventa; precioRegular: number | null; vendidos: number; hoy: string }): Venta {
  const p = d.preventa;
  const regular = d.precioRegular && d.precioRegular > 0 ? d.precioRegular : null;
  const base = { precioRegular: regular, cupo: null, quedan: null, diasParaCierre: null, motivoCierre: null, lanzamiento: p.lanzamiento };
  if (!d.activo) return { ...base, estado: "oculto", precio: null };
  if (!p.activa) return { ...base, estado: "venta", precio: regular };

  const quedan = p.cupo ? Math.max(0, p.cupo - Math.max(0, d.vendidos)) : null;
  const dias = p.cierre ? Math.round((aDia(p.cierre) - aDia(d.hoy)) / DIA_MS) : null;
  const motivo: Venta["motivoCierre"] = !p.precio ? "sin_precio" : dias != null && dias < 0 ? "fecha" : quedan === 0 ? "cupo" : null;
  return {
    ...base,
    estado: motivo ? "preventa_cerrada" : "preventa",
    precio: motivo ? null : p.precio,
    cupo: p.cupo,
    quedan,
    diasParaCierre: dias != null && dias >= 0 ? dias : null,
    motivoCierre: motivo,
  };
}

/** “Cierra hoy / mañana / en 5 días”. */
export const textoCierre = (dias: number): string =>
  dias <= 0 ? "Cierra hoy" : dias === 1 ? "Cierra mañana" : `Cierra en ${dias} días`;

export const pesos = (n: number): string => `$${n.toLocaleString("es-MX")}`;

/** “50” (% de descuento) si el precio es menor al regular. */
export const descuentoPct = (precio: number | null, regular: number | null): number | null =>
  precio && regular && regular > precio ? Math.round((1 - precio / regular) * 100) : null;

export function leerConfig(x: unknown): ConfigCurso {
  const c = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const m = (typeof c.mentoria === "object" && c.mentoria !== null ? c.mentoria : {}) as Record<string, unknown>;
  const estados: EstadoMentoria[] = ["oculta", "lista_espera", "abierta"];
  const precio = Number(m.precio_mes);
  const textos: Partial<Record<Cta, string>> = {};
  if (typeof c.cta_textos === "object" && c.cta_textos !== null) {
    for (const [k, v] of Object.entries(c.cta_textos as Record<string, unknown>)) {
      if (esUno<Cta>(CTAS, k) && typeof v === "string" && v.trim()) textos[k] = v.trim().slice(0, 400);
    }
  }
  const meta = Math.floor(Number(c.meta_semanal_min));
  return {
    mentoria: {
      estado: estados.includes(m.estado as EstadoMentoria) ? (m.estado as EstadoMentoria) : "oculta",
      curso_id: typeof m.curso_id === "string" && m.curso_id ? m.curso_id : null,
      precio_mes: Number.isFinite(precio) && precio > 0 ? precio : null,
    },
    cta_textos: textos,
    meta_semanal_min: meta > 0 && meta <= 3000 ? meta : 150,
    landing: leerLanding(c.landing),
    preventa: leerPreventa(c.preventa),
    whatsapp_texto: typeof c.whatsapp_texto === "string" && c.whatsapp_texto.trim() ? c.whatsapp_texto.trim().slice(0, 300) : null,
  };
}

/** ¿Esta lección cuenta para el avance de la ruta principal? */
export const cuentaParaAvance = (l: { etiqueta: Etiqueta; opcional: boolean }): boolean =>
  !l.opcional && l.etiqueta !== "capsula" && l.etiqueta !== "profunda" && l.etiqueta !== "evaluacion";
