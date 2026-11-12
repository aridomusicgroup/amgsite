import "server-only";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { pasoDeMezcla, type PreguntaPrevio } from "@/lib/previo-cliente-tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const TIPOS_ALBUM = ["ep", "album"];

/**
 * "Ya mezclaste: ¿le mandas un previo al cliente?" — lo que se pregunta al
 * palomear Mezclar o Masterizar.
 *
 * Sólo se pregunta cuando se puede actuar sobre la respuesta:
 *   · quien palomeó puede lanzar renders (el previo se renderiza en la PC del
 *     estudio; para el resto del equipo la pregunta sería un callejón sin salida);
 *   · el proyecto es de un cliente con pedido y correo (si no, el previo no tiene
 *     a dónde llegar: `puedeAvisar` en la lista de REAPER);
 *   · en un EP/álbum el previo es por canción, así que la palomita tiene que ser
 *     la de un tema; un "Mezclar" suelto en un álbum no tiene sesión que renderizar.
 *
 * Nunca lanza: la pregunta es un extra del palomeo, no debe tumbarlo.
 */
export async function preguntaPrevioCliente(
  sb: SB,
  d: { proyectoId: string | null; temaId: string | null; titulo: string | null },
): Promise<PreguntaPrevio | null> {
  try {
    const paso = pasoDeMezcla(d.titulo);
    if (!paso || !d.proyectoId) return null;
    if (!(await moduloPermitido("/admin/dev-logs"))) return null;

    const { data: p } = await sb
      .from("proyectos").select("titulo, tipo, order_id, contactos(nombre, email)").eq("id", d.proyectoId).maybeSingle();
    if (!p?.order_id) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacto = p.contactos as any;
    if (!String(contacto?.email ?? "").trim()) return null;

    const esAlbum = TIPOS_ALBUM.includes(p.tipo as string);
    if (esAlbum && !d.temaId) return null;

    let donde = (p.titulo as string | null) ?? "este proyecto";
    if (d.temaId) {
      const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", d.temaId).maybeSingle();
      if (t?.titulo) donde = `${donde} · ${t.titulo as string}`;
    }

    return {
      proyectoId: d.proyectoId,
      temaId: d.temaId,
      donde,
      paso,
      cliente: (contacto?.nombre as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
