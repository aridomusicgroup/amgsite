import "server-only";
import { claveRecompra, primerNombre, DIAS_REVISION } from "@/lib/recompra";
import { sugerenciasPara, type PerfilCompra } from "@/lib/recompra-oferta";
import { recompraEmail } from "@/lib/emails";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Lo que la bandeja de recompra necesita del servidor para un solo contacto.
 *
 * Se recalcula aquí en vez de confiar en lo que manda el navegador: el ancla
 * (fecha de la última compra) es lo que hace idempotente la marca, y el escalón
 * decide qué se le ofrece. Lo único que SÍ viene del navegador es el mensaje,
 * porque es justamente lo que el equipo revisa y edita antes de mandarlo.
 */
export interface DatosRecompra {
  nombre: string | null;
  email: string | null;
  /** Fecha de la última compra (YYYY-MM-DD). Sin esto no hay ciclo que marcar. */
  ancla: string;
  perfil: PerfilCompra;
}

export async function datosRecompra(sb: SB, id: string): Promise<DatosRecompra | null> {
  const [{ data: c }, { data: v }] = await Promise.all([
    sb.from("contactos").select("nombre, email, ltv").eq("id", id).single(),
    sb.from("ventas")
      .select("fecha, beat_nombre, tipo")
      .eq("contacto_id", id)
      .not("fecha", "is", null)
      .order("fecha", { ascending: false })
      .limit(1),
  ]);
  const ult = v?.[0];
  if (!c || !ult?.fecha) return null;
  return {
    nombre: (c.nombre as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    ancla: ult.fecha as string,
    perfil: {
      ltv: Number(c.ltv) || 0,
      ultimaCompraConcepto: (ult.beat_nombre as string | null) || (ult.tipo as string | null) || null,
      ultimaCompraTipo: (ult.tipo as string | null) ?? null,
    },
  };
}

/** Arma el correo tal cual se va a mandar. Lo usan la vista previa y el envío. */
export function correoRecompra(d: DatosRecompra, mensaje: string) {
  return recompraEmail({
    customerName: primerNombre(d.nombre) || null,
    mensaje,
    concepto: d.perfil.ultimaCompraConcepto,
    sugerencias: sugerenciasPara(d.perfil),
  });
}

/**
 * Sella la decisión del ciclo: agenda la revisión y deja la marca única que
 * evita que el cliente reaparezca mañana en la bandeja.
 *
 * Vive aquí (y no en la ruta) porque ahora hay DOS caminos que lo hacen — el
 * botón "ya le escribí" y el envío por correo — y si se separan, uno de los dos
 * termina dejando el ciclo sin marcar.
 */
export async function marcarRecompra(
  sb: SB,
  o: {
    id: string;
    ancla: string;
    accion: "contactado" | "omitir";
    mensaje: string | null;
    autor: string | null;
    /** Por dónde se le escribió. Solo informativo, para la ficha del contacto. */
    via?: "correo" | "manual";
    /** A qué correos se mandó (cuando `via` es "correo"). */
    destinatarios?: string[];
  },
): Promise<{ error: string } | null> {
  if (o.accion === "contactado") {
    const d = new Date();
    d.setDate(d.getDate() + DIAS_REVISION);
    const { error } = await sb
      .from("contactos")
      .update({
        proxima_accion: "Recompra: ver si contestó",
        proxima_fecha: d.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id);
    if (error) return { error: error.message };
  }

  const porCorreo = o.via === "correo";
  const { error } = await sb.from("interacciones").upsert(
    {
      contacto_id: o.id,
      // OJO: `interacciones.tipo` tiene un CHECK cerrado (supabase-crm-recompra.sql).
      // El envío por correo entra como "recompra": es la misma decisión, por otro canal.
      tipo: o.accion === "contactado" ? "recompra" : "recompra_omitida",
      resumen:
        o.accion !== "contactado"
          ? "Oportunidad de recompra descartada"
          : porCorreo
            ? `Se le mandó el correo de recompra a ${(o.destinatarios ?? []).join(", ")}`
            : "Se le escribió para ofrecerle lo siguiente (recompra)",
      ocurrio_at: new Date().toISOString(),
      external_id: claveRecompra(o.id, o.ancla),
      metadata: {
        autor: o.autor,
        ancla: o.ancla,
        mensaje: o.mensaje,
        via: o.via ?? "manual",
        ...(porCorreo ? { destinatarios: o.destinatarios ?? [] } : {}),
      },
    },
    { onConflict: "external_id" },
  );
  // La marca es lo que evita que el cliente reaparezca mañana: si no se pudo
  // escribir hay que decirlo, no fingir que quedó.
  return error ? { error: error.message } : null;
}
