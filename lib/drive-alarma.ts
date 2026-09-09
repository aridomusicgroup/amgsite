import "server-only";
import { adminEmails } from "@/lib/supabase/auth-server";
import { registrarActividad } from "@/lib/actividad";
import { pushAEmails } from "@/lib/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Avisa que Drive dejó de funcionar, UNA vez al día.
 *
 * El 9-sep el refresh token de Google se murió a las 05:38 y nadie se enteró
 * hasta las 14:30 — nueve horas en las que todo se siguió renderizando bien y
 * nada llegó a Drive. Lo que había para notarlo era un renglón `warn` en la
 * consola del panel, que hay que ir a buscar. Peor: los 3,262 archivos de
 * edición que se quedaron esperando **no marcaron error ni intentos**, porque
 * la subida truena al pedir el token, antes de tocar las filas. O sea: todo
 * detenido, y nada en rojo en ninguna pantalla.
 *
 * Esta es la parte que hace que no dependa de que alguien mire la consola.
 *
 * Una vez al día y no cada vez: el script pide token cada 2 minutos, así que
 * sin candado serían 30 avisos por hora y a la tercera nadie los lee. La llave
 * de la bitácora (`drive-caido:{día}`) es la misma técnica del aviso de pagos a
 * músicos.
 */
export async function alarmaDrive(sb: SB, motivo: string): Promise<void> {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const entidadId = `drive-caido:${hoy}`;

    const { data: yaEsta } = await sb
      .from("actividad")
      .select("id")
      .eq("entidad", "usuario")
      .eq("entidad_id", entidadId)
      .limit(1);
    if (yaEsta?.length) return;

    // Cuánto se está acumulando: es lo que convierte "hay un problema" en
    // "hay un problema y está costando".
    let esperando = 0;
    try {
      const { count } = await sb
        .from("edicion_archivos")
        .select("id", { count: "exact", head: true })
        .is("subido_at", null);
      esperando = count ?? 0;
    } catch { /* el número es de más; el aviso sale igual */ }

    const titulo = "⚠️ Drive desconectado — nada se está subiendo";
    const cuerpo = esperando
      ? `${esperando} archivo(s) esperando. Reconecta Google para que se vacíe la cola.`
      : "Reconecta Google: los renders se están quedando en el disco del estudio.";

    await registrarActividad(sb, {
      tipo: "drive_caido",
      titulo: `${titulo} — ${motivo}`,
      entidad: "usuario",
      entidad_id: entidadId,
      meta: { motivo, esperando, automatico: true },
    });

    // A los admins nada más: reconectar Drive pide la cuenta de Google dueña
    // de la carpeta, y eso no lo puede resolver nadie más del equipo.
    await pushAEmails(sb, [...new Set(adminEmails().map((e) => e.toLowerCase()))], {
      titulo,
      cuerpo,
      // Directo al arranque del OAuth: el aviso ya trae la solución en un clic,
      // no un "revisa la configuración".
      url: "https://admin.aridomusicgroup.com/api/admin/drive-oauth/start",
    });
  } catch {
    /* La alarma nunca puede tumbar la petición que la disparó: el script sigue
       necesitando su respuesta (aunque sea el 503) para saber qué pasó. */
  }
}
