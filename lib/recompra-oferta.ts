// Qué ofrecerle a cada cliente en el correo de recompra.
//
// No es un catálogo pegado igual para todos: lo que sigue depende del escalón
// en el que quedó. A quien pagó $800 por una licencia no se le abre con un
// paquete de $8,600 (se siente fuera de lugar y no abre el correo otra vez);
// a quien ya soltó $9,000 no se le ofrece "más beats" como primera opción.
//
// Los precios salen de `data/services.json` — la misma fuente que la web y el
// cotizador — para que no se desincronicen cuando cambien los paquetes.
//
// Módulo PURO: lo usan el panel (navegador) y la ruta que manda el correo.
import servicesRaw from "@/data/services.json";
import { DOMAINS, SOCIALS } from "./site";

/**
 * Lo mínimo que hay que saber del cliente para decidir qué ofrecerle. Un
 * `Contacto` completo lo cumple, pero la ruta que manda el correo arma esto con
 * dos consultas puntuales en vez de cargar los 2,000 contactos del CRM.
 */
export interface PerfilCompra {
  ltv: number;
  ultimaCompraConcepto: string | null;
  ultimaCompraTipo: string | null;
}

const services = servicesRaw as unknown as {
  bases: { id: string; price: number; includes: { es: string[] } }[];
  studio: { id: string; price: number }[];
};

const precioStudio = (id: string): number =>
  services.studio.find((s) => s.id === id)?.price ?? 0;

/**
 * El paquete con ensamble más barato: es el ancla honesta para el "desde".
 *
 * El filtro por número de instrumentos NO es un truco: separa los paquetes de
 * verdad (Tumbes 4, Alucines 6, Empedes 5) del "Beat Urbano" ($3,000), que solo
 * trae producción + mezcla y no es un ensamble. Sin esto el correo prometía
 * "paquete completo desde $3,000" — un precio real, pero de otro producto.
 */
const PAQUETE_DESDE = Math.min(
  ...services.bases.filter((b) => b.price > 0 && b.includes.es.length >= 3).map((b) => b.price),
);
const MEZCLA = precioStudio("mezcla-master");
const MEZCLA_VOCES = precioStudio("mezcla-voces");

export interface Sugerencia {
  titulo: string;
  /** Por qué le sirve A ÉL, no qué es. Es lo que hace que le den clic. */
  gancho: string;
  /** Ya formateado ("$2,500 MXN"). `null` cuando se cotiza caso por caso. */
  precio: string | null;
  url: string;
  cta: string;
}

const pesos = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;

/**
 * Escalón en el que quedó el cliente. El TIPO de la última venta manda; el LTV
 * solo lo sube (quien ya dejó $5,000+ está arriba aunque su última compra haya
 * sido chica).
 */
export type Escalon = "licencia" | "personalizado" | "grabacion" | "alto";

export function escalonDe(c: PerfilCompra): Escalon {
  const t = (c.ultimaCompraTipo ?? "").toLowerCase();
  if (/exclusiv|\bep\b|[aá]lbum|disco/.test(t) || c.ltv >= 5000) return "alto";
  if (/grabaci/.test(t)) return "grabacion";
  if (/licencia/.test(t)) return "licencia";
  if (/beat|bp|personalizad/.test(t)) return "personalizado";
  return c.ltv >= 3000 ? "personalizado" : "licencia";
}

/** El beat/servicio de su última compra, listo para meterlo en una frase. */
const loSuyo = (c: PerfilCompra): string =>
  c.ultimaCompraConcepto ? `“${c.ultimaCompraConcepto}”` : "tu último tema";

type Clave = "mezclaVoces" | "mezcla" | "cotizacion" | "paquete" | "beats" | "exclusiva";

function ofertas(c: PerfilCompra): Record<Clave, Sugerencia> {
  const suyo = loSuyo(c);
  const waExclusiva = `${SOCIALS.whatsapp}?text=${encodeURIComponent(
    `Hola, me interesa la exclusiva de ${c.ultimaCompraConcepto ?? "un beat"}`,
  )}`;
  return {
    mezclaVoces: {
      titulo: "Mezcla de voces",
      gancho: `Ya tienes ${suyo}. Grábale tu voz y nosotros la acomodamos encima para que quede pareja con el beat.`,
      precio: pesos(MEZCLA_VOCES),
      url: `${DOMAINS.main}/cotizador`,
      cta: "Cotizar mi mezcla de voces",
    },
    mezcla: {
      titulo: "Mezcla y master de tu canción",
      gancho: `Ya tienes ${suyo}. Te lo dejamos sonando parejo con lo que suena en plataformas.`,
      precio: pesos(MEZCLA),
      url: `${DOMAINS.main}/cotizador`,
      cta: "Cotizar mi mezcla",
    },
    cotizacion: {
      titulo: "Arma tu cotización a tu medida",
      gancho: "Dinos qué traes en mente y ármalo servicio por servicio: instrumentos, voces, lo que le falte. Te da el precio al instante.",
      precio: null,
      url: `${DOMAINS.main}/cotizador`,
      cta: "Abrir el cotizador",
    },
    paquete: {
      titulo: "Paquete de producción completo",
      gancho: "Tu siguiente sencillo con todo el ensamble: requinto, armonía, bajo, mezcla y master.",
      precio: `desde ${pesos(PAQUETE_DESDE)}`,
      url: `${DOMAINS.main}/#servicios`,
      cta: "Ver los paquetes",
    },
    beats: {
      titulo: "Beats nuevos en el catálogo",
      gancho: "Subimos instrumentales cada semana. Escúchalos y aparta el que te lata.",
      precio: null,
      url: DOMAINS.beats,
      cta: "Escuchar los beats",
    },
    exclusiva: {
      titulo: `La exclusiva de ${c.ultimaCompraConcepto ?? "tu beat"}`,
      gancho: "Lo sacamos de la venta y nadie más lo vuelve a usar. Si el tema jaló, es el siguiente paso.",
      precio: null,
      url: waExclusiva,
      cta: "Preguntar por la exclusiva",
    },
  };
}

/**
 * El orden IMPORTA: la primera tarjeta es la que se lee.
 *
 * A quien compró una licencia se le abre con la MEZCLA DE VOCES, no con mezcla
 * y master: ya tiene el beat mezclado, lo que le falta es que le acomoden su
 * voz encima. Es el paso inmediato y cuesta menos ($1,500 vs $2,500), así que
 * es el "sí" más fácil después de una licencia.
 *
 * "Mezcla y master" SOLO aparece en `grabacion`. Todo lo demás que vendemos
 * —beat personalizado, paquetes, exclusivas— ya lo trae incluido, así que
 * ofrecérselo es ofrecerle algo que ya pagó: se ve como que no sabemos qué le
 * vendimos. A esos se les ofrece el cotizador, que es donde arman lo que sí les
 * falta.
 */
const ORDEN: Record<Escalon, Clave[]> = {
  licencia: ["mezclaVoces", "exclusiva", "beats"],
  personalizado: ["cotizacion", "paquete", "beats"],
  grabacion: ["mezcla", "paquete", "beats"],
  alto: ["paquete", "cotizacion", "beats"],
};

export function sugerenciasPara(c: PerfilCompra): Sugerencia[] {
  const o = ofertas(c);
  return ORDEN[escalonDe(c)].map((k) => o[k]);
}
