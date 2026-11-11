import "server-only";
import { Resend } from "resend";
import { copiaAcuerdoProduccionEmail } from "@/lib/emails";
import { registrarActividad } from "@/lib/actividad";
import { pushAResponsables, destinoProyecto } from "@/lib/push";
import { renderAcuerdo } from "./acuerdo-cliente";
import { sellarInvitacion, type Invitacion } from "./invitaciones";
import { ACUERDO_PRODUCCION_VERSION, fechaLarga } from "./produccion";
import { cargarCotAcuerdo, firmaDeProduccion, marcarProyectosDeCotizacion, textoParaFirmar } from "./produccion-server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const FROM = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

export type ResultadoFirma = { ok: true } | { ok: false; status: number; error: string };

/**
 * Registra la firma del acuerdo individual de UNA producción y la libera.
 *
 * Orden a propósito: primero se guarda la firma (lo que importa legalmente) y
 * solo después se sella el enlace, se libera la producción y se avisa. Lo que
 * viene después de guardar es best-effort: si falla, la firma ya existe y no
 * se pierde.
 *
 * El correo y la cotización salen de la invitación guardada en el servidor,
 * nunca de la petición.
 */
export async function registrarFirmaProduccion(
  sb: SB,
  inv: Invitacion,
  nombre: string,
  rastro: { ip: string | null; userAgent: string | null },
): Promise<ResultadoFirma> {
  if (!inv.cotizacion_id) return { ok: false, status: 404, error: "Este enlace ya no tiene una cotización ligada. Pide uno nuevo por WhatsApp." };
  const cot = await cargarCotAcuerdo(sb, inv.cotizacion_id);
  if (!cot) return { ok: false, status: 404, error: "La cotización de este acuerdo ya no existe. Escríbenos por WhatsApp." };
  if (await firmaDeProduccion(sb, cot.id)) return { ok: false, status: 409, error: "El acuerdo de esta producción ya se firmó." };

  const t = await textoParaFirmar(cot);
  if (t.huecos.length) return { ok: false, status: 422, error: "El texto del acuerdo está incompleto. Escríbenos por WhatsApp." };
  const texto = renderAcuerdo(t.cuerpo, nombre);
  const ahora = new Date();

  const { error } = await sb.from("acuerdos_produccion").insert({
    cotizacion_id: cot.id,
    folio: cot.folio,
    email: inv.email,
    nombre,
    version: ACUERDO_PRODUCCION_VERSION,
    texto,
    ip: rastro.ip,
    user_agent: rastro.userAgent,
    aceptado_at: ahora.toISOString(),
  });
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, error: "El acuerdo de esta producción ya se firmó." };
    const falta = /relation .* does not exist|schema cache/i.test(error.message);
    return {
      ok: false,
      status: falta ? 503 : 500,
      error: falta ? "Falta correr supabase-acuerdo-produccion.sql en Supabase." : error.message,
    };
  }

  await sellarInvitacion(inv.id);

  // Lo que sigue es best-effort: la firma ya quedó guardada.
  let liberados = 0;
  try {
    liberados = await marcarProyectosDeCotizacion(sb, cot.id, false);
  } catch (e) {
    console.error("firma-produccion: no se pudo liberar el proyecto:", e);
  }

  try {
    await registrarActividad(sb, {
      tipo: "acuerdo_firmado",
      titulo: `${nombre} firmó el acuerdo de la producción ${cot.folio}${liberados ? " — ya puede arrancar" : ""}`,
      entidad: "cotizacion",
      entidad_id: cot.id,
      entidad_nombre: cot.folio,
      meta: { email: inv.email, proyectos_liberados: liberados },
    });
  } catch { /* bitácora best-effort */ }

  try {
    await avisarAlEquipo(sb, cot.id, cot.folio, nombre, liberados > 0);
  } catch { /* el aviso nunca rompe la firma */ }

  try {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const mail = copiaAcuerdoProduccionEmail({
        customerName: nombre.split(" ")[0] ?? null,
        folio: cot.folio,
        firmadoPor: nombre,
        fecha: fechaLarga(ahora),
        texto,
      });
      await new Resend(key).emails.send({ from: FROM, to: [inv.email], subject: mail.subject, html: mail.html });
    }
  } catch (e) {
    console.error("firma-produccion: no se pudo mandar la copia:", e);
  }

  return { ok: true };
}

/** Push a quienes llevan el proyecto: "ya firmó, ya pueden arrancar". */
async function avisarAlEquipo(sb: SB, cotizacionId: string, folio: string, nombre: string, hayProyecto: boolean): Promise<void> {
  const { data: proys } = await sb
    .from("proyectos")
    .select("id, titulo, responsable_id, responsables")
    .eq("cotizacion_id", cotizacionId);
  const lista = (proys ?? []) as Array<{ id: string; titulo: string; responsable_id: string | null; responsables: string[] | null }>;
  if (!lista.length) return;
  for (const p of lista) {
    await pushAResponsables(sb, [p.responsable_id, ...(p.responsables ?? [])], {
      titulo: `${p.titulo} · ya firmó el acuerdo`,
      cuerpo: `${nombre} firmó (${folio}). ${hayProyecto ? "La producción ya puede arrancar." : ""}`.trim(),
      url: destinoProyecto(p.id),
    });
  }
}
