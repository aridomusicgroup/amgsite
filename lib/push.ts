import "server-only";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "./vapid";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const PRIVATE = process.env.VAPID_PRIVATE_KEY;
let configured = false;
function ensure(): boolean {
  if (configured) return true;
  if (!PRIVATE) return false;
  webpush.setVapidDetails("mailto:latinogangbeats@gmail.com", VAPID_PUBLIC_KEY, PRIVATE);
  configured = true;
  return true;
}

interface PushMsg {
  titulo: string;
  cuerpo: string;
  url?: string;
}

const SITE = "https://admin.aridomusicgroup.com";

/**
 * Contexto del proyecto para las notificaciones: el nombre (para que se sepa de
 * qué proyecto es) y un enlace que abre el tablero filtrado a ese proyecto.
 */
export async function contextoProyecto(
  sb: SB,
  proyectoId: string | null | undefined
): Promise<{ titulo: string | null; url: string }> {
  const base = `${SITE}/admin/produccion`;
  if (!proyectoId) return { titulo: null, url: base };
  try {
    const { data } = await sb.from("proyectos").select("titulo").eq("id", proyectoId).single();
    return { titulo: (data?.titulo as string | null) ?? null, url: destinoProyecto(proyectoId) };
  } catch {
    return { titulo: null, url: base };
  }
}

/**
 * A dónde manda una notificación. `destacar` es lo que hace que el tablero
 * ABRA esa tarjeta (o esa tarea) y le prenda el resplandor, en vez de dejarte
 * en la lista completa buscando de qué te hablaban.
 */
export const destinoProyecto = (proyectoId: string): string =>
  `${SITE}/admin/produccion?destacar=${proyectoId}`;

export const destinoTarea = (tareaId: string): string =>
  `${SITE}/admin/produccion?destacar=${tareaId}`;

export const destinoContacto = (contactoId: string): string =>
  `${SITE}/admin/clientes?destacar=${contactoId}`;

/** Antepone el proyecto al mensaje: "MIENTEME · Te asignaron: Grabar voz". */
export const conProyecto = (proyecto: string | null, texto: string) =>
  proyecto ? `${proyecto} · ${texto}` : texto;

/**
 * Envía una notificación push (best-effort) a TODOS los dispositivos de los
 * responsables dados. Resuelve equipo(id) → email → suscripciones. Nunca lanza:
 * si falla, la mutación principal sigue su curso. Limpia suscripciones muertas.
 */
export async function pushAResponsables(sb: SB, responsableIds: (string | null | undefined)[], msg: PushMsg): Promise<void> {
  try {
    const ids = [...new Set(responsableIds.filter((x): x is string => Boolean(x)))];
    if (!ids.length) return;

    const { data: eq } = await sb.from("equipo").select("id, email").in("id", ids);
    const emails = (eq ?? [])
      .map((r: { email: string | null }) => r.email)
      .filter(Boolean) as string[];
    await pushAEmails(sb, emails, msg);
  } catch {
    /* best-effort: la notificación nunca rompe la acción */
  }
}

/**
 * Igual que {@link pushAResponsables} pero directo por correo, sin pasar por la
 * tabla `equipo`. Lo necesitan los avisos que son de una PERSONA y no de un rol
 * — como los recordatorios de tarea, que se los pone cada quien para sí mismo y
 * existen aunque esa persona no sea responsable de nada.
 */
export async function pushAEmails(sb: SB, correos: (string | null | undefined)[], msg: PushMsg): Promise<void> {
  try {
    if (!ensure()) return; // sin VAPID_PRIVATE_KEY → push apagado
    const emails = [
      ...new Set(correos.filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase())),
    ];
    if (!emails.length) return;

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("email", emails);
    if (!subs || !subs.length) return;

    const payload = JSON.stringify({
      title: msg.titulo,
      body: msg.cuerpo,
      url: msg.url || "https://admin.aridomusicgroup.com/admin/produccion",
    });

    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
        } catch (err: unknown) {
          // 404/410 = suscripción caducada → bórrala para no reintentar
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            try { await sb.from("push_subscriptions").delete().eq("id", s.id); } catch { /* */ }
          }
        }
      })
    );
  } catch {
    /* best-effort: la notificación nunca rompe la acción */
  }
}
