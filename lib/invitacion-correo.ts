/**
 * Correo de invitación al panel: el enlace y el contenido, SIN dependencias.
 *
 * Va aparte de `invitacion.ts` (que habla con Supabase y Resend) para poder
 * probarlo con `npm test` sin levantar nada. El marco de marca (logo y pie) lo
 * pone quien manda el correo con `wrap()`.
 */

/** Dónde vive el panel. El enlace del correo cae aquí, nunca en el sitio público. */
export const SITIO_PANEL = "https://admin.aridomusicgroup.com";

/** Tipos de enlace que Supabase puede generar para una invitación. */
const TIPOS_OTP = ["magiclink", "signup", "invite", "recovery", "email"] as const;
export type TipoOtp = (typeof TIPOS_OTP)[number];

export const esTipoOtp = (t: unknown): t is TipoOtp =>
  typeof t === "string" && (TIPOS_OTP as readonly string[]).includes(t);

const ROL_LABEL: Record<string, string> = { admin: "Admin", crm: "CRM / Marketing", produccion: "Producción" };

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A dónde cae la persona después de canjear el enlace: a elegir su contraseña. */
const DESTINO = "/admin/auth/set-password";

/**
 * El enlace que va en el correo. Lleva el token de un solo uso de Supabase hacia
 * `/admin/auth/confirm` (que ya existe: lo canjea por sesión del lado del
 * servidor, sirve en cualquier navegador y sólo acepta destinos bajo /admin).
 */
export function enlaceDeInvitacion(tokenHash: string, tipo: TipoOtp, sitio: string = SITIO_PANEL): string {
  return `${sitio}/admin/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${tipo}&next=${encodeURIComponent(DESTINO)}`;
}

/** Asunto, preheader y filas HTML (para `wrap`) de la invitación. */
export function contenidoInvitacion(d: { nombre: string | null; rol: string; url: string }): {
  subject: string; preheader: string; content: string;
} {
  const primerNombre = d.nombre?.trim().split(/\s+/)[0] || null;
  const rol = ROL_LABEL[d.rol] ?? d.rol;
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Ya tienes acceso al panel 🌵</h1>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 18px;">
        ${primerNombre ? `${esc(primerNombre)}, te` : "Te"} dimos de alta en el panel de Árido Music Group con el rol
        <b style="color:#fff;">${esc(rol)}</b>. Entra con el botón y elige tu contraseña; la próxima vez
        podrás entrar directo con tu correo y esa contraseña.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 4px;">
        <a href="${d.url}" style="display:inline-block;background:#c42f42;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:10px;">
          Entrar y crear mi contraseña
        </a>
      </td></tr></table>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:18px 0 0;">
        El enlace es de un solo uso y caduca pronto. Si ya no sirve, pídele a quien te dio de alta que te lo reenvíe.
      </p>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:8px 0 0;word-break:break-all;">
        Si el botón no funciona, copia este enlace: ${d.url}
      </p>
    </td></tr>`;
  return {
    subject: "Ya tienes acceso al panel — Árido Music Group",
    preheader: "Entra y crea tu contraseña. El enlace es de un solo uso.",
    content,
  };
}
