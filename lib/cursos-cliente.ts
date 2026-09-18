import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailsDeCliente } from "@/lib/cuenta-cliente";
import {
  accesoVigente, camposVisibles, cuentaParaAvance, esRellenar, leerConfig, renglones, validarMarcadores,
  validarQuiz, validarRecursos, validarRubrica, validarDiagnostico,
  type ConfigCurso, type ConfigPreventa, type Cta, type Etiqueta, type Marcador, type Ruta, type TipoCurso, type TipoLeccion, type TipoRecurso,
} from "@/lib/cursos-tipos";

/**
 * Capa de datos de Cursos para el panel del CLIENTE (/cuenta). Todo resuelto
 * por correo (con alias, igual que pedidos/contratos) — nunca por user id.
 * `curso_accesos` es la única fuente de verdad de quién entra a qué; un acceso
 * con `vence_en` pasado (mentoría no renovada) ya no cuenta.
 *
 * Nada de lo que sale de aquí trae IDs de Drive ni respuestas de quiz: el
 * navegador pide los archivos al proxy y manda sus respuestas a calificar.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface CursoResumen {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portadaUrl: string | null;
  tipo: TipoCurso;
  pct: number;
  venceEn: string | null;
  /** En preventa (aún no se lanza): cuándo abre. */
  preventa: { lanzamiento: string } | null;
}

/** Lo que ve el fundador mientras el curso no se lanza (no hay lecciones). */
export interface PreventaCliente { lanzamiento: string; bonos: string[] }

export interface PreguntaCliente { pregunta: string; opciones: string[]; audio?: number }

export interface LeccionCliente {
  id: string;
  titulo: string;
  tipo: TipoLeccion;
  etiqueta: Etiqueta;
  opcional: boolean;
  cta: Cta;
  urlExterna: string | null;
  duracionSeg: number | null;
  tieneArchivo: boolean;
  visto: boolean;
  segundos: number;
  /** Resultado guardado (quiz) u otros datos del progreso. */
  datos: Record<string, unknown>;
  /** Campos del guion ya escritos (sin [RELLENAR] ni notas internas). */
  notas: { label: string; texto: string }[];
  ctaTexto: string | null;
  marcadores: Marcador[];
  recursos: { titulo: string; tipo: TipoRecurso }[];
  preguntas: PreguntaCliente[];
  rubrica: { criterio: string; niveles: string[] }[];
  enVivo: { fechaHora: string | null; duracionMin: number | null } | null;
}

export interface ModuloCliente {
  id: string;
  titulo: string;
  descripcion: string | null;
  ruta: Ruta;
  lecciones: LeccionCliente[];
}

export interface CursoDetalleCliente {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoCurso;
  config: ConfigCurso;
  revisionesIncluidas: number;
  venceEn: string | null;
  modulos: ModuloCliente[];
  /** Avance de la ruta principal (sólo lecciones publicadas que cuentan). */
  pct: number;
  /** ¿Tiene la mentoría ligada a este curso vigente? */
  esMiembro: boolean;
  /** Curso en preventa: sin módulos hasta el lanzamiento. */
  preventa: PreventaCliente | null;
}

interface AccesoRow { curso_id: string; vence_en: string | null }

/** Accesos de estos correos que siguen vigentes. Tolera que la columna vence_en aún no exista. */
async function accesosVigentes(sb: SB, emails: string[], cursoId?: string): Promise<AccesoRow[]> {
  let q = sb.from("curso_accesos").select("curso_id, vence_en").in("email", emails);
  if (cursoId) q = q.eq("curso_id", cursoId);
  const { data, error } = await q;
  if (!error) return ((data ?? []) as AccesoRow[]).filter((a) => accesoVigente(a.vence_en));
  let q1 = sb.from("curso_accesos").select("curso_id").in("email", emails);
  if (cursoId) q1 = q1.eq("curso_id", cursoId);
  const { data: d1 } = await q1;
  return ((d1 ?? []) as { curso_id: string }[]).map((a) => ({ curso_id: a.curso_id, vence_en: null }));
}

/** El vencimiento más lejano entre los accesos a un curso (null = de por vida). */
const venceDe = (accesos: AccesoRow[]): string | null => {
  if (!accesos.length || accesos.some((a) => !a.vence_en)) return null;
  return accesos.map((a) => a.vence_en as string).sort().at(-1) ?? null;
};

/** Cursos a los que este correo (o un alias suyo) tiene acceso vigente, con avance. */
export async function cursosDelCliente(email: string): Promise<CursoResumen[]> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return [];
    const sb = supabaseAdmin();
    const accesos = await accesosVigentes(sb, emails);
    const cursoIds = [...new Set(accesos.map((a) => a.curso_id))];
    if (!cursoIds.length) return [];

    const COLS = "id, slug, titulo, descripcion, portada_url";
    const r1 = await sb.from("cursos").select(`${COLS}, tipo, config`).in("id", cursoIds).eq("activo", true);
    const cursos: { id: string; slug: string; titulo: string; descripcion: string | null; portada_url: string | null; tipo?: string; config?: unknown }[] | null = r1.error
      ? (await sb.from("cursos").select(COLS).in("id", cursoIds).eq("activo", true)).data
      : r1.data;
    if (!cursos?.length) return [];

    const pcts = await Promise.all(cursos.map((c) => pctAvance(sb, c.id as string, emails)));
    return cursos.map((c, i) => ({
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      portadaUrl: (c.portada_url as string | null) ?? null,
      tipo: ((c as { tipo?: string }).tipo === "mentoria" ? "mentoria" : "curso") as TipoCurso,
      pct: pcts[i],
      venceEn: venceDe(accesos.filter((a) => a.curso_id === c.id)),
      preventa: preventaDe(c.config),
    }));
  } catch {
    return [];
  }
}

/** La preventa del curso si todavía no se lanza (quien compró no ve lecciones). */
function preventaDe(config: unknown): { lanzamiento: string } | null {
  const p = leerConfig(config).preventa;
  return p.activa ? { lanzamiento: p.lanzamiento } : null;
}

/** ¿El curso sigue en preventa? Devuelve su configuración, o null si ya se lanzó. */
export async function cursoEnPreventa(cursoId: string): Promise<ConfigPreventa | null> {
  try {
    const { data } = await supabaseAdmin().from("cursos").select("config").eq("id", cursoId).maybeSingle();
    const p = leerConfig(data?.config).preventa;
    return p.activa ? p : null;
  } catch {
    return null;
  }
}

/** true si este correo (o un alias suyo) tiene acceso vigente a ese curso. */
export async function clienteTieneCurso(email: string, cursoId: string): Promise<boolean> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return false;
    return (await accesosVigentes(supabaseAdmin(), emails, cursoId)).length > 0;
  } catch {
    return false;
  }
}

const COLS_LECCION =
  "id, modulo_id, titulo, tipo, etiqueta, opcional, preview, cta, contenido, marcadores, recursos, url_externa, duracion_seg, drive_file_id, orden, publicada";

/** Detalle de un curso para el cliente. Sólo lecciones publicadas. */
export async function getCursoDetalleCliente(email: string, cursoId: string): Promise<CursoDetalleCliente | null> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return null;
    const sb = supabaseAdmin();
    const accesos = await accesosVigentes(sb, emails, cursoId);
    if (!accesos.length) return null;

    const { data: c } = await sb
      .from("cursos").select("id, slug, titulo, descripcion, tipo, config, revisiones_incluidas").eq("id", cursoId).maybeSingle();
    if (!c) return null;
    const config = leerConfig(c.config);

    // En preventa el fundador sólo ve su lugar apartado: ni el temario de lecciones.
    if (config.preventa.activa) {
      return {
        id: c.id as string, slug: c.slug as string, titulo: c.titulo as string,
        descripcion: (c.descripcion as string | null) ?? null,
        tipo: c.tipo === "mentoria" ? "mentoria" : "curso",
        config, revisionesIncluidas: Number(c.revisiones_incluidas) || 0, venceEn: venceDe(accesos),
        modulos: [], pct: 0, esMiembro: false,
        preventa: { lanzamiento: config.preventa.lanzamiento, bonos: renglones(config.preventa.bonos) },
      };
    }

    const { data: modulos } = await sb
      .from("curso_modulos").select("id, titulo, orden, ruta, descripcion").eq("curso_id", cursoId).order("orden", { ascending: true });
    const modIds = (modulos ?? []).map((m: { id: string }) => m.id);

    const { data: lecciones } = modIds.length
      ? await sb.from("curso_lecciones").select(COLS_LECCION).in("modulo_id", modIds).eq("publicada", true).order("orden", { ascending: true })
      : { data: [] };

    const leccionIds = (lecciones ?? []).map((l: { id: string }) => l.id);
    const { data: progreso } = leccionIds.length
      ? await sb.from("curso_progreso").select("leccion_id, visto, segundos_vistos, datos").in("leccion_id", leccionIds).in("email", emails)
      : { data: [] };
    const prog = new Map<string, { visto: boolean; segundos: number; datos: Record<string, unknown> }>();
    for (const p of progreso ?? []) {
      const prev = prog.get(p.leccion_id as string);
      // Con alias puede haber dos renglones: gana el que ya la vio / el más avanzado.
      prog.set(p.leccion_id as string, {
        visto: Boolean(p.visto) || Boolean(prev?.visto),
        segundos: Math.max(Number(p.segundos_vistos) || 0, prev?.segundos ?? 0),
        datos: { ...(prev?.datos ?? {}), ...((p.datos as Record<string, unknown>) ?? {}) },
      });
    }

    const porModulo = new Map<string, LeccionCliente[]>();
    for (const l of lecciones ?? []) {
      const arr = porModulo.get(l.modulo_id as string) ?? [];
      arr.push(aLeccionCliente(l, prog.get(l.id as string), config));
      porModulo.set(l.modulo_id as string, arr);
    }

    const todas = [...porModulo.values()].flat();
    const cuentan = todas.filter(cuentaParaAvance);
    const pct = cuentan.length ? Math.round((cuentan.filter((l) => l.visto).length / cuentan.length) * 100) : 0;

    const mentoriaId = config.mentoria.curso_id;
    const esMiembro = mentoriaId ? (await accesosVigentes(sb, emails, mentoriaId)).length > 0 : false;

    return {
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      tipo: c.tipo === "mentoria" ? "mentoria" : "curso",
      config,
      revisionesIncluidas: Number(c.revisiones_incluidas) || 0,
      venceEn: venceDe(accesos),
      modulos: (modulos ?? []).map((m: { id: string; titulo: string; descripcion: string | null; ruta: string }) => ({
        id: m.id,
        titulo: m.titulo,
        descripcion: m.descripcion ?? null,
        ruta: (m.ruta as Ruta) || "principal",
        lecciones: porModulo.get(m.id) ?? [],
      })),
      pct,
      esMiembro,
      preventa: null,
    };
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aLeccionCliente(l: any, p: { visto: boolean; segundos: number; datos: Record<string, unknown> } | undefined, config: ConfigCurso): LeccionCliente {
  const contenido = (l.contenido ?? {}) as Record<string, unknown>;
  const etiqueta = (l.etiqueta as Etiqueta) || "nucleo";
  const cta = (l.cta as Cta) || "ninguno";
  const ctaPropio = typeof contenido.cta_texto === "string" && !esRellenar(contenido.cta_texto) ? contenido.cta_texto : null;
  const ctaTexto = cta === "ninguno" ? null : ctaPropio ?? config.cta_textos[cta] ?? null;
  return {
    id: l.id,
    titulo: l.titulo,
    tipo: (l.tipo as TipoLeccion) || "video",
    etiqueta,
    opcional: Boolean(l.opcional),
    cta,
    urlExterna: l.url_externa ?? null,
    duracionSeg: l.duracion_seg == null ? null : Number(l.duracion_seg),
    tieneArchivo: Boolean(l.drive_file_id),
    visto: p?.visto ?? false,
    segundos: p?.segundos ?? 0,
    datos: p?.datos ?? {},
    notas: camposVisibles(contenido, etiqueta),
    ctaTexto,
    marcadores: validarMarcadores(l.marcadores),
    recursos: validarRecursos(l.recursos).map((r) => ({ titulo: r.titulo, tipo: r.tipo })),
    // Sin `correcta` ni `explicacion`: esas vuelven del servidor al calificar.
    preguntas: validarQuiz(contenido.preguntas).map((q) => ({
      pregunta: q.pregunta, opciones: q.opciones, ...(q.audio != null ? { audio: q.audio } : {}),
    })),
    rubrica: validarRubrica(contenido.rubrica).map((r) => ({
      criterio: r.criterio,
      niveles: r.niveles.map((n) => (esRellenar(n) ? "" : n)),
    })),
    enVivo: l.tipo === "en_vivo"
      ? {
          fechaHora: typeof contenido.fecha_hora === "string" ? contenido.fecha_hora : null,
          duracionMin: Number(contenido.duracion_min) || null,
        }
      : null,
  };
}

export interface LeccionStream {
  cursoId: string;
  tipo: TipoLeccion;
  driveFileId: string | null;
  publicada: boolean;
  preview: boolean;
  recursos: { titulo: string; drive_file_id: string; tipo: TipoRecurso }[];
  contenido: Record<string, unknown>;
  etiqueta: Etiqueta;
  titulo: string;
}

/** Datos mínimos de una lección para el proxy y las APIs (validan dueño del curso antes de servir). */
export async function leccionParaStream(leccionId: string): Promise<LeccionStream | null> {
  try {
    const sb = supabaseAdmin();
    const r1 = await sb
      .from("curso_lecciones")
      .select("tipo, titulo, drive_file_id, publicada, preview, recursos, contenido, etiqueta, curso_modulos!inner(curso_id)")
      .eq("id", leccionId)
      .maybeSingle();
    let data = r1.data;
    if (r1.error) {
      // SQL v2 sin correr: se comporta como antes (todo publicado, sin extras).
      ({ data } = await sb.from("curso_lecciones").select("tipo, titulo, drive_file_id, curso_modulos!inner(curso_id)").eq("id", leccionId).maybeSingle());
    }
    if (!data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const cursoId = d.curso_modulos?.curso_id as string | undefined;
    if (!cursoId) return null;
    return {
      cursoId,
      tipo: (d.tipo as TipoLeccion) || "video",
      titulo: String(d.titulo ?? ""),
      driveFileId: (d.drive_file_id as string | null) ?? null,
      publicada: d.publicada ?? true,
      preview: Boolean(d.preview),
      recursos: validarRecursos(d.recursos),
      contenido: (d.contenido as Record<string, unknown>) ?? {},
      etiqueta: (d.etiqueta as Etiqueta) || "nucleo",
    };
  } catch {
    return null;
  }
}

/** Preguntas completas (con respuestas) de un quiz, para calificar en el servidor. */
export const preguntasDe = (l: LeccionStream) => validarQuiz(l.contenido.preguntas);
export const diagnosticoDe = (l: LeccionStream) => validarDiagnostico(l.contenido.diagnostico);
export const rubricaDe = (l: LeccionStream) => validarRubrica(l.contenido.rubrica);

/** Marca (o desmarca) una lección como vista para este correo. */
export async function marcarProgreso(email: string, leccionId: string, visto: boolean, extra?: { datos?: Record<string, unknown> }): Promise<void> {
  const sb = supabaseAdmin();
  const fila: Record<string, unknown> = {
    leccion_id: leccionId,
    email: email.trim().toLowerCase(),
    visto,
    visto_en: visto ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (extra?.datos) fila.datos = extra.datos;
  await sb.from("curso_progreso").upsert(fila, { onConflict: "leccion_id,email" });
}

/**
 * Guarda el intento de un quiz. Aprobar una vez basta: un intento peor después
 * no le quita la lección vista ni su mejor puntaje.
 */
export async function registrarQuiz(
  email: string,
  leccionId: string,
  r: { pct: number; correctas: number; total: number },
  aprobado: boolean,
): Promise<void> {
  const sb = supabaseAdmin();
  const correo = email.trim().toLowerCase();
  const { data: ya } = await sb.from("curso_progreso").select("visto, datos").eq("leccion_id", leccionId).eq("email", correo).maybeSingle();
  const datosPrevios = ((ya?.datos as Record<string, unknown> | null) ?? {});
  const previo = datosPrevios.quiz as { pct?: number } | undefined;
  const intento = { ...r, en: new Date().toISOString() };
  const mejor = !previo || r.pct >= Number(previo.pct ?? 0) ? intento : previo;
  await marcarProgreso(correo, leccionId, aprobado || Boolean(ya?.visto), {
    datos: { ...datosPrevios, quiz: mejor, ultimo: intento },
  });
}

/** Guarda en qué segundo del video se quedó (sin tocar si ya la vio). */
export async function guardarPosicion(email: string, leccionId: string, segundos: number): Promise<void> {
  const sb = supabaseAdmin();
  const correo = email.trim().toLowerCase();
  const seg = Math.max(0, Math.min(Math.floor(segundos), 24 * 3600));
  const { data: ya } = await sb.from("curso_progreso").select("id").eq("leccion_id", leccionId).eq("email", correo).maybeSingle();
  if (ya) {
    await sb.from("curso_progreso").update({ segundos_vistos: seg, updated_at: new Date().toISOString() }).eq("id", ya.id);
  } else {
    await sb.from("curso_progreso").insert({ leccion_id: leccionId, email: correo, visto: false, segundos_vistos: seg });
  }
}

/** Avance de la ruta principal de un curso para estos correos (lecciones publicadas que cuentan). */
async function pctAvance(sb: SB, cursoId: string, emails: string[]): Promise<number> {
  const { data: modulos } = await sb.from("curso_modulos").select("id").eq("curso_id", cursoId);
  const modIds = (modulos ?? []).map((m: { id: string }) => m.id);
  if (!modIds.length) return 0;
  const r1 = await sb
    .from("curso_lecciones").select("id, etiqueta, opcional").in("modulo_id", modIds).eq("publicada", true);
  let lecciones = r1.data;
  if (r1.error) ({ data: lecciones } = await sb.from("curso_lecciones").select("id").in("modulo_id", modIds));
  const cuentan = ((lecciones ?? []) as { id: string; etiqueta?: Etiqueta; opcional?: boolean }[])
    .filter((l) => cuentaParaAvance({ etiqueta: l.etiqueta ?? "nucleo", opcional: Boolean(l.opcional) }));
  if (!cuentan.length) return 0;
  const { data: progreso } = await sb
    .from("curso_progreso").select("leccion_id").in("leccion_id", cuentan.map((l) => l.id)).in("email", emails).eq("visto", true);
  const vistas = new Set((progreso ?? []).map((p: { leccion_id: string }) => p.leccion_id));
  return Math.round((vistas.size / cuentan.length) * 100);
}

/** Todos los correos de la cuenta (principal + alias): entregas y bitácora se buscan con todos. */
export async function correosDe(email: string): Promise<string[]> {
  return emailsDeCliente(email);
}

/** Datos del curso que necesitan las APIs del alumno (entregas, llamados, checkout). */
export async function cursoBasico(cursoId: string): Promise<{
  id: string; slug: string; titulo: string; tipo: TipoCurso; config: ConfigCurso; revisionesIncluidas: number; precioMxn: number | null; activo: boolean;
} | null> {
  const { data: c } = await supabaseAdmin().from("cursos").select("*").eq("id", cursoId).maybeSingle();
  if (!c) return null;
  return {
    id: c.id as string,
    slug: c.slug as string,
    titulo: c.titulo as string,
    tipo: c.tipo === "mentoria" ? "mentoria" : "curso",
    config: leerConfig(c.config),
    revisionesIncluidas: Number(c.revisiones_incluidas ?? 1) || 0,
    precioMxn: c.precio_mxn == null ? null : Number(c.precio_mxn),
    activo: Boolean(c.activo),
  };
}

/** ¿Este correo tiene vigente la mentoría ligada a ese curso? */
export async function esMiembroMentoria(email: string, config: ConfigCurso): Promise<boolean> {
  if (!config.mentoria.curso_id) return false;
  return clienteTieneCurso(email, config.mentoria.curso_id);
}
