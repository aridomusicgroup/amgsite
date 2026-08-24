import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailsDeCliente } from "@/lib/cuenta-cliente";
import { ACUERDO_VERSIONES } from "./acuerdo-cliente";
import { SEEDS, type AcuerdoSeed } from "./seeds";
import { FAMILIA_LABEL, familiasDeCliente, pendientes, type Familia } from "./familias";

/**
 * El texto vigente de UNA familia: el editado desde Plantillas (tipo
 * `acuerdo_<familia>`) o, si no lo han tocado, la semilla del código. Mismo
 * patrón que los contratos — el panel nunca se queda sin texto.
 */
export async function getAcuerdoTexto(familia: Familia): Promise<AcuerdoSeed> {
  try {
    const { data } = await supabaseAdmin()
      .from("plantillas")
      .select("titulo, cuerpo")
      .eq("tipo", `acuerdo_${familia}`)
      .single();
    if (data?.cuerpo) {
      return { titulo: (data.titulo as string) || SEEDS[familia].titulo, cuerpo: data.cuerpo as string };
    }
  } catch {
    /* respaldo */
  }
  return SEEDS[familia];
}

/**
 * Qué familias le tocan a este cliente según lo que YA compró o tiene en
 * producción, cruzando `proyectos` y `ventas` por su(s) correo(s).
 *
 * Solo mira compras pasadas: a alguien que nunca ha comprado nada a la medida
 * no le toca firmar nada al entrar — el panel de un comprador de catálogo
 * puro no debe pedirle un acuerdo de anticipo del 50% que jamás le aplicó.
 */
async function familiasQueLeTocan(email: string): Promise<Familia[]> {
  const emails = await emailsDeCliente(email);
  if (!emails.length) return [];
  const sb = supabaseAdmin();

  try {
    const { data: contactos } = await sb.from("contactos").select("id").in("email", emails);
    const ids = (contactos ?? []).map((c) => c.id as string);
    if (!ids.length) return [];

    const [{ data: proyectos }, { data: ventas }] = await Promise.all([
      sb.from("proyectos").select("tipo").in("contacto_id", ids),
      sb.from("ventas").select("tipo").in("contacto_id", ids),
    ]);
    return familiasDeCliente(proyectos ?? [], ventas ?? []);
  } catch {
    return []; // sin CRM disponible: no bloquear el panel por esto
  }
}

/** Familias de esas que le tocan, y que YA aceptó en su versión vigente. */
async function familiasAceptadas(email: string, deLasQueLeTocan: Familia[]): Promise<Familia[]> {
  if (!deLasQueLeTocan.length) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("cliente_acuerdos")
      .select("familia, version")
      .eq("email", email.toLowerCase())
      .in("familia", deLasQueLeTocan);
    return (data ?? [])
      .filter((r) => r.version === ACUERDO_VERSIONES[r.familia as Familia])
      .map((r) => r.familia as Familia);
  } catch {
    return [];
  }
}

export interface AcuerdoPendiente extends AcuerdoSeed {
  familia: Familia;
  label: string;
}

/**
 * Lo que falta por firmar, con el texto ya resuelto.
 *
 * Ante cualquier error devuelve `[]` (= no molestar): si el CRM no responde o
 * la tabla de aceptaciones falla, es mejor dejar entrar al cliente a ver sus
 * pedidos que encerrarlo en una pantalla que no puede guardar.
 */
export async function acuerdosPendientes(email: string): Promise<AcuerdoPendiente[]> {
  try {
    const suyas = await familiasQueLeTocan(email);
    if (!suyas.length) return [];
    const aceptadas = await familiasAceptadas(email, suyas);
    const faltan = pendientes(suyas, aceptadas);
    if (!faltan.length) return [];

    return Promise.all(
      faltan.map(async (familia) => {
        const texto = await getAcuerdoTexto(familia);
        return { familia, label: FAMILIA_LABEL[familia], ...texto };
      }),
    );
  } catch {
    return [];
  }
}
