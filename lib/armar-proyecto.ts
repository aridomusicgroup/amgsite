import "server-only";
import { crearTareasDeCanciones, type TemaCreado } from "@/lib/produccion-tareas";
import { asignarEnPortal } from "@/lib/musico-asignar";
import { instrumentosDeTema, nombreTema, temasDeCotizacion, type Tema } from "@/lib/temas";

/**
 * El armado de un EP/álbum, igual venga de "Convertir en venta" o de un pago
 * por Stripe.
 *
 * Antes cada camino armaba a su manera y el de la venta manual no armaba nada:
 * sin la lista de canciones buscaba la plantilla de tareas `ep`, que no existe,
 * y TRiP MX nació sin una sola tarea. Aquí sale todo de los temas de la
 * cotización: un tema = una tarea con sus pasos, "Grabar X" sólo de lo que lleva
 * ese tema, y el músico de cada instrumento colgado del tema donde toca — así en
 * su portal ve un renglón por canción y su pista cae en la carpeta de esa
 * canción.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const clave = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export type TemaPlan = Tema & {
  /** Instrumentos ya decididos. Sin esto salen de los conceptos del tema. */
  instrumentos?: string[];
};

export async function armarTemas(
  sb: SB,
  d: {
    proyectoId: string;
    tipo: string;
    temas: TemaPlan[];
    elegidos: { instrumento: string; musico_id: string }[];
    responsableId: string | null;
    actor: string;
  },
): Promise<TemaCreado[]> {
  const creados = await crearTareasDeCanciones(
    sb,
    d.proyectoId,
    d.tipo,
    d.temas.map((t, i) => ({
      titulo: nombreTema(t, i),
      instrumentos: t.instrumentos ?? instrumentosDeTema(t),
      conceptos: t.conceptos,
    })),
    [],
    d.responsableId,
  );

  for (const tema of creados) {
    for (const inst of tema.instrumentos) {
      const e = d.elegidos.find((x) => clave(x.instrumento) === clave(inst));
      if (e) await asignarEnPortal(sb, d.proyectoId, tema.id, e.musico_id, e.instrumento, d.actor);
    }
  }
  return creados;
}

/**
 * Los temas guardados en una cotización o, si es vieja (sin `temas`), "Canción N"
 * con el reparto por cantidad. null si no se encontró la cotización.
 */
export async function temasDeLaCotizacion(sb: SB, cotizacionId: string): Promise<Tema[] | null> {
  const leer = (cols: string) => sb.from("cotizaciones").select(cols).eq("id", cotizacionId).maybeSingle();
  let r = await leer("items, num_canciones, temas");
  if (r.error) r = await leer("items, num_canciones");
  return r.data ? temasDeCotizacion(r.data) : null;
}
