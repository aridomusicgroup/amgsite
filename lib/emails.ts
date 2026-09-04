import { SOCIALS, DOMAINS } from "./site";

/**
 * Logo de la marca en los correos. Debe ser URL absoluta y pública: el cliente
 * de correo la descarga desde fuera del sitio. `lgb-email.png` es la versión
 * ligera (340px, 7 KB) del mismo logo que usa el panel de cliente — el original
 * mide 16852px y pesa 907 KB, impensable para un correo.
 * Alto/ancho van como ATRIBUTOS HTML además de CSS porque Outlook ignora el CSS.
 */
const LOGO_URL = `${DOMAINS.main}/logos/lgb-email.png`;
const LOGO_ANCHO = 170;
const LOGO_ALTO = 49;

/** Encabezado de marca. Única fuente de verdad: úsalo en TODA plantilla de correo. */
export function logoEmailHtml(ancho = LOGO_ANCHO): string {
  const alto = Math.round((ancho / LOGO_ANCHO) * LOGO_ALTO);
  return `<a href="${DOMAINS.main}" style="text-decoration:none;">
    <img src="${LOGO_URL}" alt="Latino Gang Beats" width="${ancho}" height="${alto}"
         style="display:block;border:0;outline:none;width:${ancho}px;height:${alto}px;max-width:100%;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:2px;-ms-interpolation-mode:bicubic;" />
  </a>`;
}

/**
 * Plantillas de correo con marca LGB (HTML inline, compatible con clientes de correo).
 */

interface OrderEmailData {
  customerName: string | null;
  items: { description: string; amount: number }[];
  total: number;
  currency: string;
  type: "beat" | "servicio";
  downloads: { title: string; url: string }[];
  note: string | null;
}

/** Escapa texto libre (mensajes que escribe el equipo) antes de meterlo al HTML. */
export const escHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Texto que Gmail/Apple Mail muestran en gris junto al asunto ANTES de abrir.
 * Si no se manda, el cliente de correo agarra lo primero que encuentre en el
 * HTML (normalmente "Latino Gang Beats", inútil). Va oculto y con relleno para
 * que no se cuele el inicio del cuerpo.
 */
const preheaderHtml = (texto: string) => `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">
    ${escHtml(texto)}${"&#8199;&#65279;&#847; ".repeat(60)}
  </div>`;

const wrap = (content: string, preheader?: string) => `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? preheaderHtml(preheader) : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding-bottom:28px;">
          ${logoEmailHtml()}
        </td></tr>
        ${content}
        <tr><td align="center" style="padding-top:32px;border-top:1px solid #222;">
          <p style="color:#666;font-size:12px;margin:16px 0 4px;">Latino Gang Beats · Árido Music Group 🌵</p>
          <p style="color:#666;font-size:12px;margin:0;">
            <a href="${SOCIALS.whatsapp}" style="color:#25D366;text-decoration:none;">WhatsApp ${SOCIALS.whatsappDisplay}</a>
            &nbsp;·&nbsp;
            <a href="mailto:${SOCIALS.email}" style="color:#c42f42;text-decoration:none;">${SOCIALS.email}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const fmtMoney = (n: number, cur: string) =>
  `$${n.toLocaleString("es-MX")} ${cur.toUpperCase()}`;

export function customerOrderEmail(d: OrderEmailData): { subject: string; html: string } {
  const itemsRows = d.items
    .map(
      (i) => `
      <tr>
        <td style="color:#ccc;font-size:14px;padding:8px 0;border-bottom:1px solid #1d1d1d;">${i.description}</td>
        <td align="right" style="color:#fff;font-size:14px;padding:8px 0;border-bottom:1px solid #1d1d1d;white-space:nowrap;">${fmtMoney(i.amount, d.currency)}</td>
      </tr>`
    )
    .join("");

  const downloadsBlock =
    d.downloads.length > 0
      ? `
      <tr><td style="padding-top:24px;">
        <p style="color:#fff;font-size:16px;font-weight:bold;margin:0 0 12px;">📥 Descarga tus beats:</p>
        ${d.downloads
          .map(
            (dl) => `
          <a href="${dl.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:30px;font-size:14px;font-weight:bold;margin-bottom:10px;">${dl.title}</a>`
          )
          .join("")}
        <p style="color:#888;font-size:12px;margin:8px 0 0;">Guarda este correo: tus enlaces seguirán funcionando. Tu certificado de licencia va adjunto en este correo (PDF). 📄</p>
      </td></tr>`
      : "";

  const serviceBlock =
    d.type === "servicio"
      ? `
      <tr><td style="padding-top:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
          <tr><td style="padding:18px;">
            <p style="color:#c42f42;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0 0 10px;">MIENTRAS TANTO, VE PREPARANDO:</p>
            <p style="color:#ccc;font-size:14px;margin:0 0 6px;">📝 Tu letra (o la idea del tema)</p>
            <p style="color:#ccc;font-size:14px;margin:0 0 6px;">🎵 2-3 canciones de referencia del estilo que buscas</p>
            <p style="color:#ccc;font-size:14px;margin:0;">🎸 La tonalidad si la sabes — o una nota de voz cantando</p>
            <p style="color:#777;font-size:12px;margin:12px 0 0;">Te contactamos en menos de 24 h. Tu servicio incluye 2 rondas de revisiones.</p>
          </td></tr>
        </table>
      </td></tr>`
      : "";

  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">¡Gracias por tu compra${d.customerName ? `, ${d.customerName}` : ""}! 🌵</h1>
      <p style="color:#999;font-size:14px;margin:0 0 24px;">Tu pago se procesó correctamente. Aquí está el detalle:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${itemsRows}
        <tr>
          <td style="color:#fff;font-size:16px;font-weight:bold;padding:14px 0 0;">Total</td>
          <td align="right" style="color:#fff;font-size:20px;font-weight:bold;padding:14px 0 0;white-space:nowrap;">${fmtMoney(d.total, d.currency)}</td>
        </tr>
      </table>
    </td></tr>
    ${downloadsBlock}
    ${serviceBlock}`;

  return {
    subject:
      d.type === "beat"
        ? "🎵 Tu compra en Latino Gang Beats — descarga adentro"
        : "🌵 Pedido recibido — arrancamos tu producción",
    html: wrap(content),
  };
}

export function customerContractEmail(d: {
  customerName: string | null;
  beatTitle: string;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Tu contrato de exclusividad 📄</h1>
      <p style="color:#999;font-size:14px;margin:0 0 18px;">${d.customerName ? `${d.customerName}, adjuntamos` : "Adjuntamos"} el <b style="color:#fff;">Acuerdo de Producción Musical</b> de la instrumental <b style="color:#fff;">${d.beatTitle}</b>, con todos tus datos.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
        <tr><td style="padding:18px;">
          <p style="color:#c42f42;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0 0 10px;">QUÉ SIGUE:</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 8px;">1. Revisa el contrato adjunto (PDF).</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 8px;">2. Fírmalo y respóndenos este correo con tu copia firmada.</p>
          <p style="color:#ccc;font-size:14px;margin:0;">3. El beat queda retirado de la venta pública: es 100% tuyo. 🌵</p>
        </td></tr>
      </table>
      <p style="color:#777;font-size:12px;margin:16px 0 0;">¿Dudas con el contrato? Respóndenos este correo o escríbenos por WhatsApp.</p>
    </td></tr>`;

  return {
    subject: `📄 Contrato de exclusividad — ${d.beatTitle}`,
    html: wrap(content),
  };
}

export function internalContractEmail(d: {
  name: string | null;
  email: string;
  beatTitle: string;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#3a1414;border:1px solid #c42f42;border-radius:14px;margin-bottom:18px;">
        <tr><td style="padding:16px;">
          <p style="color:#ff6b6b;font-size:14px;font-weight:bold;margin:0 0 6px;">⚠️ RETIRA ESTE BEAT DE LA VENTA</p>
          <p style="color:#ddd;font-size:13px;margin:0;">Se vendió la <b style="color:#fff;">exclusiva</b> de "<b style="color:#fff;">${d.beatTitle}</b>". Quítalo de <b style="color:#fff;">BeatStars</b> y de la tienda para que no se vuelva a vender.</p>
        </td></tr>
      </table>
      <h1 style="color:#fff;font-size:20px;margin:0 0 8px;">📄 Contrato enviado al cliente</h1>
      <p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Cliente:</b> ${d.name ?? "—"} · ${d.email}</p>
      <p style="color:#999;font-size:13px;margin:6px 0 0;">Adjunta va la copia del Acuerdo de Producción Musical (exclusividad) con todos sus datos.</p>
    </td></tr>`;

  return {
    subject: `📄 ⚠️ Exclusiva vendida — RETIRA "${d.beatTitle}" de venta`,
    html: wrap(content),
  };
}

export function cotizacionEmail(d: {
  customerName: string | null;
  folio: string;
  total: number;
  moneda: string;
  vigenciaDias: number;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Tu cotización 🌵</h1>
      <p style="color:#999;font-size:14px;margin:0 0 18px;">${d.customerName ? `${d.customerName}, adjuntamos` : "Adjuntamos"} tu cotización <b style="color:#fff;">${d.folio}</b> en PDF.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
        <tr><td style="padding:18px;">
          <p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Total:</b> ${fmtMoney(d.total, d.moneda)}</p>
          <p style="color:#ccc;font-size:14px;margin:0;"><b style="color:#fff;">Vigencia:</b> ${d.vigenciaDias} días</p>
        </td></tr>
      </table>
      <p style="color:#777;font-size:12px;margin:16px 0 0;">¿La aprobamos? Respóndenos este correo o escríbenos por WhatsApp y te pasamos el enlace de pago para arrancar. 🎸</p>
    </td></tr>`;
  return { subject: `🌵 Tu cotización ${d.folio} — Árido Music Group`, html: wrap(content) };
}

/**
 * Enlace para firmar el acuerdo ANTES del anticipo.
 *
 * Va como correo aparte del de la cotización (no un párrafo dentro de ese
 * template) porque tiene su propia acción — un botón, no un adjunto — y
 * porque no siempre hay uno que mandar (solo cuando el tipo de servicio tiene
 * familia de acuerdo).
 */
export function firmaAcuerdoEmail(d: {
  customerName: string | null;
  familiaLabel: string;
  folio: string;
  url: string;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Antes de tu anticipo 📝</h1>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 18px;">
        ${d.customerName ? `${escHtml(d.customerName)}, para` : "Para"} arrancar con tu cotización
        <b style="color:#fff;">${escHtml(d.folio)}</b> nos falta que firmes el acuerdo de
        <b style="color:#fff;">${escHtml(d.familiaLabel.toLowerCase())}</b>. Toma dos minutos y es antes de
        cualquier pago.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 4px;">
        <a href="${d.url}" style="display:inline-block;background:#c42f42;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:10px;">
          Leer y firmar el acuerdo
        </a>
      </td></tr></table>
      <p style="color:#777;font-size:12px;margin:18px 0 0;">Si el botón no funciona, copia este enlace: ${d.url}</p>
    </td></tr>`;
  return { subject: `📝 Firma el acuerdo de ${d.folio} — Árido Music Group`, html: wrap(content) };
}

export function contratoEmail(d: {
  customerName: string | null;
  tipoLabel: string;
  concepto: string | null;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Tu contrato 📄</h1>
      <p style="color:#999;font-size:14px;margin:0 0 18px;">${d.customerName ? `${d.customerName}, adjuntamos` : "Adjuntamos"} tu <b style="color:#fff;">${d.tipoLabel}</b>${d.concepto ? ` — <b style="color:#fff;">${d.concepto}</b>` : ""} en PDF.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
        <tr><td style="padding:18px;">
          <p style="color:#c42f42;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0 0 10px;">QUÉ SIGUE:</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 8px;">1. Revisa el contrato adjunto (PDF).</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 8px;">2. Fírmalo y respóndenos este correo con tu copia firmada.</p>
          <p style="color:#ccc;font-size:14px;margin:0;">3. Arrancamos. 🌵</p>
        </td></tr>
      </table>
      <p style="color:#777;font-size:12px;margin:16px 0 0;">¿Dudas con el contrato? Respóndenos este correo o escríbenos por WhatsApp.</p>
    </td></tr>`;
  return { subject: `📄 Tu contrato — Árido Music Group`, html: wrap(content) };
}

export function progresoTareaEmail(d: {
  customerName: string | null;
  concepto: string;
  tarea: string;
  hechas: number;
  total: number;
  entregado: boolean;
  url: string;
}): { subject: string; html: string } {
  const pct = d.total > 0 ? Math.round((d.hechas / d.total) * 100) : 0;
  const barra = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;"><tr>
      <td style="background:#222;border-radius:99px;height:10px;padding:0;">
        <table width="${Math.max(pct, 4)}%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#c42f42;border-radius:99px;height:10px;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td>
    </tr></table>`;
  const content = d.entregado
    ? `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">¡Tu producción está lista! 🎉</h1>
      <p style="color:#999;font-size:14px;margin:0 0 4px;">${d.customerName ? `${d.customerName}, terminamos` : "Terminamos"} <b style="color:#fff;">${d.concepto}</b>. Completamos las ${d.total} tareas. 🌵</p>
      ${barra}
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;margin-top:8px;">Ver el detalle de mi producción</a>
    </td></tr>`
    : `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Vamos avanzando 🎬</h1>
      <p style="color:#999;font-size:14px;margin:0 0 4px;">${d.customerName ? `${d.customerName}, completamos` : "Completamos"} una etapa de <b style="color:#fff;">${d.concepto}</b>:</p>
      <p style="color:#c42f42;font-size:15px;font-weight:bold;margin:8px 0 2px;">✅ ${d.tarea}</p>
      <p style="color:#888;font-size:13px;margin:0;">${d.hechas} de ${d.total} tareas completadas (${pct}%)</p>
      ${barra}
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;margin-top:8px;">Ver el avance en vivo</a>
    </td></tr>`;
  return {
    subject: d.entregado ? `🎉 ${d.concepto} — ¡lista!` : `🎬 Avance en tu producción — ${d.concepto}`,
    html: wrap(content),
  };
}

/** Aviso al cliente de que su producción ya es visible en su cuenta (/cuenta). */
export function clienteAccesoEmail(d: {
  customerName: string | null;
  concepto: string;
  url: string;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Ya puedes ver tu producción 🎬</h1>
      <p style="color:#999;font-size:14px;margin:0 0 14px;">${d.customerName ? `${d.customerName}, tu` : "Tu"} producción <b style="color:#fff;">${d.concepto}</b> ya está en tu cuenta. Entra para seguir el avance en vivo, ver tus contratos y tus beats.</p>
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">Entrar a mi cuenta</a>
      <p style="color:#666;font-size:12px;margin:14px 0 0;">Si es tu primera vez, elige “Primera vez / olvidé mi contraseña” para crear tu contraseña con este mismo correo.</p>
    </td></tr>`;
  return { subject: `🎬 Tu producción ${d.concepto} ya está en tu cuenta`, html: wrap(content) };
}

/**
 * Aviso de que un render quedó listo y ya lo puede escuchar en su cuenta.
 *
 * El archivo NO se manda adjunto ni como enlace público: vive detrás de su
 * login, así que el botón lleva a /cuenta. Un WAV de entregables pesa decenas
 * de MB y ningún correo lo aguanta.
 */
export function renderListoEmail(d: {
  customerName: string | null;
  concepto: string;
  tipo: "previo" | "entregables" | "stems";
  archivos: number;
  url: string;
}): { subject: string; html: string } {
  const copy = {
    previo: {
      titulo: "Ya tienes un previo 🎧",
      texto: "para que lo escuches y nos digas qué te parece",
      subject: `🎧 Nuevo previo de ${d.concepto}`,
      boton: "Escuchar el previo",
      nota: "Se escucha desde tu cuenta, sin descargar nada.",
    },
    entregables: {
      titulo: "Tus archivos finales están listos 🎉",
      texto: "ya con la mezcla y el máster finales",
      subject: `🎉 ${d.concepto} — archivos finales listos`,
      boton: "Descargar mis archivos",
      nota: "Entra a tu cuenta y descárgalos desde ahí. Son archivos grandes, mejor desde una computadora.",
    },
    stems: {
      titulo: "Tus stems están listos 🎛️",
      texto: `son ${d.archivos} pistas por separado, ya con mezcla y máster`,
      subject: `🎛️ Stems de ${d.concepto}`,
      boton: "Descargar mis stems",
      nota: "Entra a tu cuenta y descárgalos desde ahí. Son archivos grandes, mejor desde una computadora.",
    },
  }[d.tipo];

  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">${copy.titulo}</h1>
      <p style="color:#999;font-size:14px;margin:0 0 14px;">${d.customerName ? `${d.customerName}, subimos` : "Subimos"} material nuevo de <b style="color:#fff;">${escHtml(d.concepto)}</b> ${copy.texto}.</p>
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">${copy.boton}</a>
      <p style="color:#666;font-size:12px;margin:14px 0 0;">${copy.nota}</p>
    </td></tr>`;
  return { subject: copy.subject, html: wrap(content) };
}

/**
 * Previo para el músico de sesión: la pista sobre la que va a grabar.
 *
 * Lleva BPM y tonalidad en grande porque es lo primero que necesita para
 * preparar su parte — el nombre del archivo también los trae, pero en el correo
 * se ven sin abrir nada.
 */
/**
 * "Te toca grabar esto" — la invitación al portal del músico.
 *
 * El enlace ES la llave: no hay contraseña. Por eso dura una semana (no 30
 * minutos como el de restablecer contraseña de un cliente): un músico no
 * siempre abre el correo el mismo día, y un enlace vencido lo deja fuera sin
 * forma de entrar por su cuenta.
 */
/**
 * "Tu portal está listo" — el enlace sin una tarea de por medio.
 *
 * Hace falta porque el portal del músico NO tiene contraseña: el enlace es la
 * única puerta. Sin este correo, prenderle el portal a alguien no le servía de
 * nada hasta que se le asignara una canción — y mientras tanto acababa
 * intentando entrar por el panel de clientes, donde nunca le va a llegar nada
 * (ahí se exige tener una compra o un contrato).
 */
export function accesoMusicoEmail(d: {
  nombre: string;
  enlace: string;
  conTrabajo: boolean;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Tu portal está listo 🎺</h1>
      <p style="color:#999;font-size:14px;margin:0 0 16px;">
        ${escHtml(d.nombre.split(" ")[0])}, aquí entras a ver qué te toca grabar y a mandarnos tus pistas.
        ${d.conTrabajo ? "Ya tienes trabajo asignado esperándote." : "Todavía no tienes nada asignado; en cuanto te toquemos algo, aparece ahí."}
      </p>
      <a href="${d.enlace}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">Abrir mi portal</a>
      <p style="color:#666;font-size:12px;margin:14px 0 0;">
        No necesitas contraseña ni crear cuenta: con este enlace entras directo. Dura una semana —
        si se vence, pídenos otro. Guárdalo en tus favoritos.
      </p>
    </td></tr>`;
  return { subject: "🎺 Tu portal de ARIDO", html: wrap(content) };
}

export function asignacionMusicoEmail(d: {
  nombre: string;
  cancion: string;
  instrumento: string;
  nota: string | null;
  enlace: string;
}): { subject: string; html: string } {
  const indicaciones = d.nota
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;margin-bottom:16px;">
        <tr><td style="padding:14px 16px;">
          <p style="color:#c42f42;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 6px;">INDICACIONES</p>
          <p style="color:#ddd;font-size:14px;margin:0;line-height:1.5;">${escHtml(d.nota)}</p>
        </td></tr>
      </table>`
    : "";
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Te toca grabar 🎺</h1>
      <p style="color:#999;font-size:14px;margin:0 0 16px;">${escHtml(d.nombre.split(" ")[0])}, te asignamos <b style="color:#fff;">${escHtml(d.instrumento)}</b> en <b style="color:#fff;">${escHtml(d.cancion)}</b>.</p>
      ${indicaciones}
      <a href="${d.enlace}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">Abrir mi portal</a>
      <p style="color:#666;font-size:12px;margin:14px 0 0;">Ahí escuchas la referencia y subes tu grabación. No necesitas contraseña — con este enlace entras directo. Dura una semana.</p>
    </td></tr>`;
  return { subject: `🎺 Te toca ${d.instrumento} en ${d.cancion}`, html: wrap(content) };
}

export function previoMusicoEmail(d: {
  musico: string | null;
  proyecto: string;
  bpm: number;
  tonalidad: string;
  instrumentos: string[];
  url: string;
}): { subject: string; html: string } {
  const parte = d.instrumentos.length ? ` de <b style="color:#fff;">${escHtml(d.instrumentos.join(", "))}</b>` : "";
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">Pista lista para grabar 🎷</h1>
      <p style="color:#999;font-size:14px;margin:0 0 16px;">${d.musico ? `${escHtml(d.musico)}, aquí` : "Aquí"} está el previo de <b style="color:#fff;">${escHtml(d.proyecto)}</b> para que prepares tu parte${parte}.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;margin-bottom:16px;">
        <tr>
          <td align="center" style="padding:16px;border-right:1px solid #222;">
            <p style="color:#c42f42;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 4px;">TEMPO</p>
            <p style="color:#fff;font-size:26px;font-weight:bold;margin:0;">${d.bpm}<span style="font-size:13px;color:#888;"> bpm</span></p>
          </td>
          <td align="center" style="padding:16px;">
            <p style="color:#c42f42;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 4px;">TONALIDAD</p>
            <p style="color:#fff;font-size:26px;font-weight:bold;margin:0;">${escHtml(d.tonalidad)}</p>
          </td>
        </tr>
      </table>
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">Escuchar y descargar la pista</a>
      <p style="color:#666;font-size:12px;margin:14px 0 0;">Se abre en Google Drive. Cualquier duda contéstanos este correo o mándanos WhatsApp.</p>
    </td></tr>`;
  return { subject: `🎷 ${d.proyecto} — ${d.bpm}bpm en ${d.tonalidad}`, html: wrap(content) };
}

/**
 * Correo de recompra: el mismo mensaje que se manda por WhatsApp, pero armado
 * como correo — con lo que le toca comprar después y un botón para contestar
 * por donde de verdad contesta la gente (WhatsApp).
 *
 * Tres decisiones de diseño:
 *  1. El mensaje del equipo va PRIMERO y como nota personal, no como copy de
 *     campaña. Si abre y lo primero que ve es un banner de oferta, se va.
 *  2. Las sugerencias van numeradas y ordenadas: la primera es la que se lee.
 *     El precio se muestra siempre que exista — esconderlo hasta el clic es lo
 *     que hace que la gente no dé el clic.
 *  3. El botón grande es de WhatsApp, no "comprar". El objetivo del correo es
 *     que CONTESTE, no que pague en frío.
 */
export function recompraEmail(d: {
  customerName: string | null;
  /** Borrador que el equipo revisó (y pudo editar) en el panel. Texto plano. */
  mensaje: string;
  concepto: string | null;
  sugerencias: { titulo: string; gancho: string; precio: string | null; url: string; cta: string }[];
}): { subject: string; html: string } {
  const nom = (d.customerName ?? "").trim();

  // Los saltos de línea del textarea se vuelven párrafos: pegado en un solo
  // bloque el mensaje se lee como aviso automático, que es justo lo que no es.
  const parrafos = escHtml(d.mensaje.trim())
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="color:#e8e8e8;font-size:16px;line-height:1.6;margin:0 0 12px;">${p}</p>`,
    )
    .join("");

  const tarjetas = d.sugerencias
    .map(
      (s, i) => `
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
          <tr>
            <td width="44" valign="top" style="padding:16px 0 16px 16px;">
              <span style="color:#c42f42;font-size:15px;font-weight:bold;font-family:Georgia,serif;">0${i + 1}</span>
            </td>
            <td valign="top" style="padding:16px 16px 16px 0;">
              <p style="color:#ffffff;font-size:15px;font-weight:bold;margin:0 0 4px;">${escHtml(s.titulo)}</p>
              <p style="color:#9a9a9a;font-size:13px;line-height:1.5;margin:0 0 10px;">${escHtml(s.gancho)}</p>
              ${s.precio ? `<p style="color:#4ade80;font-size:14px;font-weight:bold;margin:0 0 10px;">${escHtml(s.precio)}</p>` : ""}
              <a href="${s.url}" style="color:#c42f42;font-size:13px;font-weight:bold;text-decoration:none;">${escHtml(s.cta)} &rsaquo;</a>
            </td>
          </tr>
        </table>
      </td></tr>`,
    )
    .join("");

  const waTexto = nom
    ? `Hola, soy ${nom}. Vi su correo 🌵`
    : "Hola, vi su correo 🌵";
  const waUrl = `${SOCIALS.whatsapp}?text=${encodeURIComponent(waTexto)}`;

  const content = `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-left:3px solid #c42f42;border-radius:0 14px 14px 0;">
        <tr><td style="padding:20px 20px 14px;">
          ${parrafos}
          <p style="color:#666;font-size:12px;margin:14px 0 0;">— Árido Music Group 🌵</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding-top:30px;padding-bottom:12px;">
      <p style="color:#c42f42;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0;">LO QUE SIGUE PARA TI</p>
    </td></tr>
    ${tarjetas}

    <tr><td style="padding-top:22px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="background:#25D366;border-radius:30px;">
          <a href="${waUrl}" style="display:block;color:#0a2e16;text-decoration:none;padding:15px;font-size:16px;font-weight:bold;">
            💬 Escríbenos por WhatsApp
          </a>
        </td></tr>
      </table>
      <p style="color:#666;font-size:12px;text-align:center;margin:12px 0 0;">
        O responde este correo — lo lee una persona, no un robot.
      </p>
    </td></tr>`;

  const subject = d.concepto
    ? `${nom ? `${nom}, ¿` : "¿"}qué sigue después de “${d.concepto}”? 🌵`
    : `${nom ? `${nom}, ¿` : "¿"}le seguimos? 🌵`;

  return {
    subject,
    html: wrap(content, `Lo que te toca después de ${d.concepto ?? "tu último tema"} — y precios.`),
  };
}

/**
 * Recordatorio de una tarea, a la hora que la persona pidió.
 *
 * Va con TODO lo que necesita para actuar sin abrir el panel: de qué proyecto
 * es, para quién, la fecha comprometida, sus notas y las subtareas que siguen
 * pendientes. Un correo que solo dijera "acuérdate de tu tarea" obliga a entrar
 * a buscar de qué se trataba, y a esa hora es justo lo que nadie hace.
 */
export function recordatorioTareaEmail(d: {
  /** Nombre de quien puso el recordatorio (para el saludo). */
  paraNombre: string | null;
  tarea: string;
  proyecto: string | null;
  folio: string | null;
  cliente: string | null;
  /** Fecha comprometida de la tarea, ya formateada ("mar 5 ago"). */
  fechaTarea: string | null;
  responsable: string | null;
  notasTarea: string | null;
  /** La nota que escribió al ponerse el recordatorio ("llevar el disco duro"). */
  notaRecordatorio: string | null;
  pendientes: string[];
  /** Cuándo pidió que le llegara, ya formateado. */
  cuando: string;
  url: string;
  /** Quién se lo puso, si NO fue quien lo recibe. Cambia el tono del correo. */
  dePartede?: string | null;
}): { subject: string; html: string } {
  const fila = (etiqueta: string, valor: string) => `
    <tr>
      <td width="96" valign="top" style="color:#777;font-size:13px;padding:5px 10px 5px 0;white-space:nowrap;">${escHtml(etiqueta)}</td>
      <td valign="top" style="color:#e8e8e8;font-size:13px;padding:5px 0;">${escHtml(valor)}</td>
    </tr>`;

  const filas = [
    d.proyecto ? fila("Proyecto", d.folio ? `${d.proyecto} · ${d.folio}` : d.proyecto) : "",
    d.cliente ? fila("Cliente", d.cliente) : "",
    d.responsable ? fila("Responsable", d.responsable) : "",
    d.fechaTarea ? fila("Fecha de la tarea", d.fechaTarea) : "",
  ].join("");

  const bloqueNota = d.notaRecordatorio
    ? `
      <tr><td style="padding-top:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-left:3px solid #c42f42;border-radius:0 12px 12px 0;">
          <tr><td style="padding:14px 16px;">
            <p style="color:#c42f42;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 6px;">${
              d.dePartede ? escHtml(`NOTA DE ${d.dePartede.toUpperCase()}`) : "TU NOTA"
            }</p>
            <p style="color:#e8e8e8;font-size:14px;line-height:1.5;margin:0;">${escHtml(d.notaRecordatorio)}</p>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const bloqueNotasTarea = d.notasTarea
    ? `
      <tr><td style="padding-top:16px;">
        <p style="color:#777;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 6px;">NOTAS DE LA TAREA</p>
        <p style="color:#bbb;font-size:13px;line-height:1.6;margin:0;white-space:pre-line;">${escHtml(d.notasTarea)}</p>
      </td></tr>`
    : "";

  const bloquePendientes = d.pendientes.length
    ? `
      <tr><td style="padding-top:16px;">
        <p style="color:#777;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 8px;">FALTAN (${d.pendientes.length})</p>
        ${d.pendientes
          .map(
            (p) =>
              `<p style="color:#ccc;font-size:13px;margin:0 0 5px;">☐ ${escHtml(p)}</p>`,
          )
          .join("")}
      </td></tr>`
    : "";

  const content = `
    <tr><td>
      <p style="color:#c42f42;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0 0 8px;">⏰ RECORDATORIO · ${escHtml(d.cuando)}</p>
      <h1 style="color:#fff;font-size:22px;line-height:1.3;margin:0 0 4px;">${escHtml(d.tarea)}</h1>
      <p style="color:#666;font-size:13px;margin:0 0 16px;">${
        d.dePartede
          ? `${d.paraNombre ? `${escHtml(d.paraNombre)}, te` : "Te"} lo puso ${escHtml(d.dePartede)}.`
          : d.paraNombre
            ? `Tú te lo pusiste, ${escHtml(d.paraNombre)}.`
            : "Tú te lo pusiste."
      }</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:14px;">
        <tr><td style="padding:14px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">${filas || fila("Tarea suelta", "sin proyecto ligado")}</table>
        </td></tr>
      </table>
    </td></tr>
    ${bloqueNota}
    ${bloqueNotasTarea}
    ${bloquePendientes}
    <tr><td style="padding-top:24px;">
      <a href="${d.url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">
        Abrir la tarea en el panel
      </a>
    </td></tr>`;

  return {
    subject: `⏰ ${d.tarea}${d.proyecto ? ` — ${d.proyecto}` : ""}`,
    html: wrap(content, `Recordatorio que pusiste para ${d.cuando}.`),
  };
}

export function internalOrderEmail(d: {
  email: string;
  phone: string | null;
  name: string | null;
  items: { description: string; amount: number }[];
  total: number;
  currency: string;
  type: string;
  note: string | null;
  source: string | null;
}): { subject: string; html: string } {
  const content = `
    <tr><td>
      <h1 style="color:#fff;font-size:22px;margin:0 0 16px;">💰 Nueva venta: ${fmtMoney(d.total, d.currency)} (${d.type})</h1>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:14px;">
        <tr><td style="padding:18px;">
          <p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Cliente:</b> ${d.name ?? "—"} · ${d.email}</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Teléfono:</b> ${d.phone ?? "no dejó"} ${d.phone ? `· <a href="https://wa.me/${d.phone.replace(/\D/g, "")}" style="color:#25D366;">abrir WhatsApp</a>` : ""}</p>
          <p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Compró:</b> ${d.items.map((i) => i.description).join(" · ")}</p>
          ${d.note ? `<p style="color:#ccc;font-size:14px;margin:0 0 6px;"><b style="color:#fff;">Nota del cliente:</b> ${d.note}</p>` : ""}
          ${d.source ? `<p style="color:#ccc;font-size:14px;margin:0;"><b style="color:#fff;">Origen:</b> ${d.source}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>`;

  return {
    subject: `💰 Venta ${fmtMoney(d.total, d.currency)} — ${d.items[0]?.description.slice(0, 50) ?? d.type}`,
    html: wrap(content),
  };
}
