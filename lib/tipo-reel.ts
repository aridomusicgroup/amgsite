// Qué tipo de contenido es un reel. Módulo puro.
//
// El análisis del 12-sep mostró que humor y rankings rinden el doble que venta y
// consejos. Para seguirlo mes a mes hay que etiquetar cada reel. Esto propone
// una etiqueta por palabras de la descripción; si no hay pista clara, lo deja
// SIN clasificar (no adivina), y una persona lo corrige desde el panel. Lo que
// elige una persona gana siempre.

export const TIPOS_REEL = [
  { id: "humor", label: "Humor / tendencia" },
  { id: "ranking", label: "Rankings y comparativas" },
  { id: "venta", label: "Venta / servicio" },
  { id: "consejo", label: "Consejos para artistas" },
  { id: "proceso", label: "Proceso / estudio" },
  { id: "otro", label: "Otro" },
] as const;

export type TipoReel = (typeof TIPOS_REEL)[number]["id"];

export const TIPO_REEL_LABEL: Record<string, string> = Object.fromEntries(TIPOS_REEL.map((t) => [t.id, t.label]));

export const esTipoReel = (v: unknown): v is TipoReel => TIPOS_REEL.some((t) => t.id === v);

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// En orden: la primera que casa gana. Venta va antes porque un reel de
// "comparando requintos, cotiza el tuyo" es, para el negocio, de venta.
const REGLAS: [TipoReel, RegExp][] = [
  ["venta", /\b(cotiza|cotizacion|precio|promo|descuento|disponible|contrata|agenda|escribenos|mandanos|link en|beat personalizado|oferta|paquete|compra)/],
  ["ranking", /\b(top ?\d|ranking|los mas|las mas|mejores|comparando|comparacion|vs\b|versus|cual es mejor|exotic)/],
  ["consejo", /\b(consejo|tip|tips|como (hacer|grabar|mezclar|sonar|lograr)|aprende|si eres artista|antes de grabar|errores)/],
  ["proceso", /\b(proceso|detras de|sesion|grabando|en el estudio|asi se hizo|making of|behind)/],
  ["humor", /(jaj|😂|🤣|😆|\bpov\b|\bcuando (tu|el|la|te)\b|\bnadie:|\bmeme\b|\btrend)/],
];

/** Tipo propuesto por la descripción, o null si no hay pista clara. */
export function clasificarReel(caption: string | null | undefined): TipoReel | null {
  const t = sinAcentos(String(caption ?? ""));
  if (!t.trim()) return null;
  for (const [tipo, re] of REGLAS) if (re.test(t)) return tipo;
  return null;
}

/** Mediana de una lista de números (0 si está vacía). */
export function mediana(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
