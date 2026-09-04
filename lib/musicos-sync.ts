// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Quién toca qué en ESTA venta, elegido por una persona. */
export interface MusicoElegido {
  instrumento: string;
  musico_id: string;
}

/** Parte "TOLOLOCHE, CHARCHETAS" en lista limpia. */
function parseInstrumentos(v: unknown): string[] {
  return String(v || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

interface MusicoCat {
  id: string;
  nombre: string;
  instrumentos: string[] | null;
  tarifa: unknown;
  activo: boolean | null;
}

/**
 * ¿Este músico toca ese instrumento?
 *
 * Subcadena en los dos sentidos, como siempre: en la venta puede venir
 * "Tololoche" y en el catálogo "tololoche, bajo".
 */
const toca = (m: MusicoCat, inst: string): boolean => {
  const il = inst.toLowerCase();
  return (m.instrumentos || []).some((x) => {
    const xl = String(x).toLowerCase();
    return xl === il || il.includes(xl) || xl.includes(il);
  });
};

/**
 * Genera los pagos PENDIENTES a músicos de una venta.
 *
 * Antes esto repartía: creaba un pago por CADA músico del catálogo que tocara
 * el instrumento. Como hay dos tololoches (Adal Oche, Ángel Rocha) y dos
 * trombones (Jorge Orlando, Samuel Torres), una venta con cualquiera de esos
 * dos instrumentos generaba pagos dobles — y `ventas.costo_extra` es la suma de
 * todos, así que el reparto de socios salía con un costo inventado. Pasó de
 * verdad: la venta I0080 tiene dos trombones pendientes de $600 cada uno.
 *
 * Ahora:
 *  - Con `elegidos` (lo normal, viene del formulario): un pago por entrada, con
 *    el músico y el instrumento que una persona escogió.
 *  - Sin `elegidos` (el webhook de Stripe, que no tiene a nadie a quién
 *    preguntarle): si el instrumento tiene UN candidato se crea su pago; si
 *    tiene dos o más NO se crea ninguno. Un pago de menos se ve —
 *    `PagosMusicoSection` sigue mostrando las sugerencias por instrumento— y
 *    uno de más es silencioso y descuadra el reparto.
 *
 * En los dos casos no se le crea un pago a quien ya tenga uno en esa venta: eso
 * es lo que faltaba y le duplicó el pago a alguien a quien ya se le había pagado.
 *
 * Best-effort: nunca lanza, para no tumbar la creación de la venta.
 */
export async function crearPagosMusicoPendientes(
  sb: SB,
  ventaId: string,
  extras: unknown,
  elegidos?: MusicoElegido[] | null,
): Promise<void> {
  try {
    if (!ventaId) return;

    const { data: musicos } = await sb.from("musicos").select("id, nombre, instrumentos, tarifa, activo");
    if (!musicos || !musicos.length) return;
    const cat = musicos as MusicoCat[];

    // Quién ya tiene pago aquí: no se le crea otro.
    const { data: previos } = await sb.from("pagos_musico").select("musico").eq("venta_id", ventaId);
    const yaTienen = new Set(
      (previos ?? []).map((r: { musico: unknown }) => String(r.musico ?? "").trim().toLowerCase()),
    );

    const filas: Record<string, unknown>[] = [];
    const agregar = (m: MusicoCat, instrumento: string) => {
      const clave = String(m.nombre).trim().toLowerCase();
      if (yaTienen.has(clave)) return;
      yaTienen.add(clave);   // y tampoco dos veces dentro de esta misma tanda
      filas.push({
        venta_id: ventaId,
        musico_id: m.id,
        musico: m.nombre,              // se conserva: respaldo si se borra del catálogo
        instrumento,
        monto: Number(m.tarifa) || 0,  // tarifa del catálogo, editable después
        fecha: null,
        pagado: false,
        nota: `Auto: ${instrumento}`,  // se mantiene por las pantallas que aún la leen
      });
    };

    if (elegidos && elegidos.length) {
      for (const e of elegidos) {
        const m = cat.find((x) => x.id === e.musico_id);
        if (!m || m.activo === false) continue;
        agregar(m, String(e.instrumento || "").trim() || (m.instrumentos ?? [])[0] || "");
      }
    } else {
      for (const inst of parseInstrumentos(extras)) {
        const candidatos = cat.filter((m) => m.activo !== false && toca(m, inst));
        // Ambiguo: mejor ninguno que el equivocado o los dos.
        if (candidatos.length === 1) agregar(candidatos[0], inst);
      }
    }

    if (!filas.length) return;
    await sb.from("pagos_musico").insert(filas);

    // Recalcula costo_extra = suma de pagos (mismo criterio que la API de pagos-musico).
    const { data: pm } = await sb.from("pagos_musico").select("monto").eq("venta_id", ventaId);
    const sum = (pm ?? []).reduce((a: number, r: { monto: unknown }) => a + (Number(r.monto) || 0), 0);
    await sb.from("ventas").update({ costo_extra: sum }).eq("id", ventaId);
  } catch {
    /* best-effort: no romper la creación de la venta */
  }
}

/**
 * Los músicos que pueden tocar cada instrumento, para que una persona elija.
 *
 * Lo usa el formulario de la venta: cuando un instrumento tiene dos candidatos
 * hay que preguntar, y cuando tiene uno se pone solo.
 */
export async function candidatosPorInstrumento(
  sb: SB,
  instrumentos: string[],
): Promise<Record<string, { id: string; nombre: string; tarifa: number; portal: boolean }[]>> {
  const salida: Record<string, { id: string; nombre: string; tarifa: number; portal: boolean }[]> = {};
  try {
    const { data } = await sb.from("musicos").select("id, nombre, instrumentos, tarifa, activo, portal_activo");
    const cat = (data ?? []) as (MusicoCat & { portal_activo?: boolean })[];
    for (const inst of instrumentos) {
      salida[inst] = cat
        .filter((m) => m.activo !== false && toca(m, inst))
        .map((m) => ({
          id: m.id,
          nombre: m.nombre,
          tarifa: Number(m.tarifa) || 0,
          portal: Boolean(m.portal_activo),
        }));
    }
  } catch {
    /* sin catálogo: el formulario simplemente no ofrece a nadie */
  }
  return salida;
}
