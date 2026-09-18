import "server-only";
import { revalidatePath } from "next/cache";
import { hoyMx, leerConfig, leerPreventa, validarPreventa } from "@/lib/cursos-tipos";
import { correosConAcceso, listaAvisame } from "@/lib/curso-preventa";
import { cursoAbiertoEmail, cursoAbiertoLeadEmail, enviarMasivo } from "@/lib/emails-cursos";
import { registrarActividad } from "@/lib/actividad";

/**
 * El estado de venta que se elige en el panel: Oculto · Preventa · A la venta.
 * Se guarda en `activo` + `config.preventa.activa`. Pasar de preventa a la
 * venta ES el lanzamiento: abre el contenido a los fundadores y, si se pide,
 * les avisa por correo (y a la lista Avísame).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type EstadoAdmin = "oculto" | "preventa" | "venta";
export const ESTADOS_ADMIN: EstadoAdmin[] = ["oculto", "preventa", "venta"];
const LABEL: Record<EstadoAdmin, string> = { oculto: "Oculto", preventa: "Preventa", venta: "A la venta" };

type Resultado =
  | { ok: true; lanzado: boolean; avisados: { fundadores: number; lista: number } | null }
  | { ok: false; error: string; status: number };

export async function cambiarEstadoCurso(
  sb: SB,
  d: { id: string; estado: EstadoAdmin; avisar: boolean; actor: string | null; preventa?: unknown },
): Promise<Resultado> {
  const { data: c } = await sb.from("cursos").select("id, slug, titulo, tipo, activo, precio_mxn, config").eq("id", d.id).maybeSingle();
  if (!c) return { ok: false, error: "Curso no encontrado.", status: 404 };
  const config = leerConfig(c.config);
  const regular = c.precio_mxn == null ? null : Number(c.precio_mxn);
  const antes: EstadoAdmin = !c.activo ? "oculto" : config.preventa.activa ? "preventa" : "venta";

  // Al abrir la preventa el panel manda lo escrito en su tarjeta (sin pasar por “Guardar”).
  if (d.estado === "preventa" && d.preventa !== undefined) {
    config.preventa = { ...leerPreventa(d.preventa), activa: config.preventa.activa };
  }

  if (d.estado === "preventa") {
    if (c.tipo === "mentoria") return { ok: false, error: "La mentoría no tiene preventa.", status: 400 };
    if (!config.preventa.precio) return { ok: false, error: "Primero pon el precio de fundador en la tarjeta “Preventa”.", status: 400 };
    const err = validarPreventa(config.preventa, regular);
    if (err) return { ok: false, error: err, status: 400 };
  }

  // Ocultar no cambia si el curso ya se lanzó o no; sólo lo esconde.
  const activa = d.estado === "preventa" ? true : d.estado === "venta" ? false : config.preventa.activa;
  const { error } = await sb.from("cursos").update({
    activo: d.estado !== "oculto",
    config: { ...config, preventa: { ...config.preventa, activa } },
    updated_at: new Date().toISOString(),
  }).eq("id", d.id);
  if (error) return { ok: false, error: error.message, status: 500 };

  const lanzado = config.preventa.activa && !activa;
  let avisados: { fundadores: number; lista: number } | null = null;
  if (lanzado && d.avisar) {
    const [conAcceso, lista] = await Promise.all([correosConAcceso(sb, d.id), listaAvisame(sb, d.id)]);
    const yaDentro = new Set(conAcceso);
    // La clave con la fecha evita el doble envío por un doble clic el mismo día.
    const clave = `lanzamiento-${d.id}-${hoyMx()}`;
    avisados = {
      fundadores: await enviarMasivo(conAcceso, cursoAbiertoEmail({ curso: c.titulo, cursoId: d.id }), `${clave}-fundadores`),
      lista: await enviarMasivo(
        lista.filter((e) => !yaDentro.has(e)),
        cursoAbiertoLeadEmail({ curso: c.titulo, slug: c.slug, precio: regular && regular > 0 ? regular : null }),
        `${clave}-lista`,
      ),
    };
  }

  if (antes !== d.estado) {
    await registrarActividad(sb, {
      tipo: "curso_estado_cambiado",
      titulo: `“${c.titulo}”: ${LABEL[antes]} → ${LABEL[d.estado]}${lanzado ? " (lanzamiento)" : ""}${
        avisados ? ` · correo a ${avisados.fundadores} alumnos y ${avisados.lista} de la lista Avísame` : ""}`,
      actor: d.actor,
      entidad_id: d.id,
      entidad_nombre: c.titulo,
    });
  }
  revalidarSitio();
  return { ok: true, lanzado, avisados };
}

/** El inicio y /cursos son estáticos (ISR): se refrescan al cambiar un curso. */
export function revalidarSitio(): void {
  try {
    revalidatePath("/");
    revalidatePath("/cursos");
  } catch {
    /* fuera de una petición (scripts): el ISR los refresca solo */
  }
}
