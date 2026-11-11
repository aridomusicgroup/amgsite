import type { AcuerdoSeed } from "./seeds";

/**
 * Acuerdo válido SOLO para una producción.
 *
 * A diferencia de los acuerdos por familia (lib/acuerdos/seeds.ts), que se
 * firman una vez por correo+familia y cubren todo lo futuro, este nace de UNA
 * cotización y se extingue con ella. Su firma no cuenta como firma de ninguna
 * familia, y la firma de una familia no lo reemplaza.
 *
 * Módulo PURO: sin base de datos ni imports en tiempo de ejecución, para poder
 * probarlo solo.
 */

/** Se sube a mano cuando el texto cambia de fondo. Se guarda con cada firma. */
export const ACUERDO_PRODUCCION_VERSION = "2026-11";

/** Plantilla editable (tabla `plantillas`): mismo patrón que `acuerdo_<familia>`. */
export const ACUERDO_PRODUCCION_TIPO = "acuerdo_produccion";

/**
 * Plazo de la cesión de derechos patrimoniales cuando la cotización no dice
 * otro. Sin plazo expreso la ley presume uno corto, así que el texto siempre
 * lo dice. PENDIENTE de confirmar con abogado.
 */
export const PLAZO_CESION_DEFAULT = "quince años";

/** Rondas de revisión incluidas cuando la cotización no dice otro número. */
export const RONDAS_REVISION_DEFAULT = "2";

export interface VariablesProduccion {
  folio: string;
  /** Ya con formato legible ("10 de noviembre de 2026"). */
  fecha_cotizacion: string;
  /** Nombre de la producción, tal como se cotizó. */
  titulo: string;
  rondas_revision?: string;
  plazo_cesion?: string;
}

const CONTRACARGOS = `CONTRACARGOS: Ante cualquier inconformidad, EL CLIENTE notificará por escrito a EL PRODUCTOR y concederá 5 días hábiles para resolverla antes de iniciar un contracargo o reversión de pago vía Stripe, PayPal o entidad bancaria. Iniciarlo sin agotar este paso es incumplimiento y obliga a EL CLIENTE a cubrir los gastos administrativos y legales razonables que genere, debidamente comprobados.`;

export const ACUERDO_PRODUCCION_SEED: AcuerdoSeed = {
  titulo: "Acuerdo de producción individual",
  cuerpo: `Entre Arido Music Group, en lo sucesivo "EL PRODUCTOR", y {{cliente}}, en lo sucesivo "EL CLIENTE", se celebra el presente acuerdo, que rige exclusivamente la producción descrita en la cláusula 1, al tenor de las siguientes cláusulas:

1. PRODUCCIÓN AMPARADA Y ALCANCE LIMITADO: Este acuerdo se refiere única y exclusivamente a la producción identificada en la cotización {{folio}} de fecha {{fecha_cotizacion}}, denominada {{titulo}} (en lo sucesivo, "LA PRODUCCIÓN"). No es un acuerdo marco y no aplica a producciones, ampliaciones o servicios futuros, para los cuales las partes firmarán un acuerdo nuevo. Su firma no sustituye, modifica ni genera la aceptación de ningún otro acuerdo de EL PRODUCTOR.

2. DOCUMENTOS Y PRELACIÓN: Forman parte de este acuerdo la cotización {{folio}} y sus anexos. En alcance, monto, fechas y esquema de pago prevalece la cotización; en todo lo demás, prevalece este acuerdo. Cualquier cambio deberá constar por escrito y ser aceptado por ambas partes, incluso por correo electrónico o por el panel de cliente.

3. ANTICIPO Y RESERVA DE AGENDA: El pago del anticipo reserva la agenda de EL PRODUCTOR para LA PRODUCCIÓN. Por sí solo no implica el inicio del trabajo creativo o técnico.

4. CONDICIONES PARA INICIAR: EL PRODUCTOR iniciará el trabajo creativo y técnico cuando se hayan cumplido las tres condiciones siguientes: (a) EL CLIENTE haya firmado este acuerdo; (b) EL PRODUCTOR haya recibido el anticipo; y (c) EL PRODUCTOR haya recibido por escrito el brief y los materiales necesarios. Los plazos de entrega no corren mientras falte alguna.

5. PLAZO PARA FIRMAR Y DEVOLUCIÓN: Si EL CLIENTE pagó el anticipo y no firma este acuerdo dentro de los 15 días naturales siguientes al pago, cualquiera de las partes podrá dar por terminada la relación mediante aviso por escrito. En ese caso EL PRODUCTOR devolverá el anticipo por el mismo medio de pago, en un plazo de 10 días hábiles, descontando únicamente las comisiones de procesamiento de pago no recuperables y el costo del trabajo que hubiera iniciado por solicitud escrita de EL CLIENTE.

6. PLAZOS Y REVISIONES: El plazo de entrega es el indicado en la cotización y comienza al cumplirse las condiciones de la cláusula 4. Se suspende mientras EL PRODUCTOR espere respuesta, aprobación o materiales de EL CLIENTE. LA PRODUCCIÓN incluye {{rondas_revision}} rondas de revisión; las adicionales, o los cambios que modifiquen lo acordado, se cotizan por separado.

7. PAGO, MORA Y SUSPENSIÓN: El monto y el esquema de pago son los de la cotización. En caso de retraso se aplicará un interés moratorio del 2% mensual sobre el saldo vencido. Mientras exista saldo vencido, EL PRODUCTOR podrá suspender la producción y la entrega de archivos, y la fecha de entrega se recorrerá en la misma medida. El incumplimiento de pago por más de 30 días faculta a EL PRODUCTOR a dar por terminado el acuerdo, conservando lo pagado por el trabajo ya realizado.

8. TITULARIDAD Y CESIÓN DE DERECHOS: Los derechos morales de EL PRODUCTOR son irrenunciables e inalienables. Los derechos patrimoniales sobre LA PRODUCCIÓN se transmitirán a EL CLIENTE únicamente cuando haya liquidado el 100% del monto pactado, por el plazo de {{plazo_cesion}}, para todo el mundo y para todos los medios y modalidades de explotación, salvo que la cotización indique otro alcance. Hasta la liquidación EL PRODUCTOR conserva la titularidad completa y EL CLIENTE no podrá distribuir, monetizar, registrar ni explotar LA PRODUCCIÓN. Si hay coautoría, la autoría y el porcentaje editorial de cada parte son los indicados en la cotización.

9. COLABORADORES: EL PRODUCTOR declara contar, o contará antes de la entrega final, con las autorizaciones necesarias de los intérpretes, ingenieros y demás colaboradores que él haya contratado, para que la transmisión de la cláusula 8 sea efectiva. EL CLIENTE responde por los colaboradores que él mismo aporte o designe.

10. MATERIAL DE EL CLIENTE: EL CLIENTE declara que la letra, voz, muestras y demás material que entregue es de su autoría o cuenta con los permisos necesarios, y responde frente a cualquier reclamo de terceros derivado de ese material.

11. ORIGINALIDAD: EL PRODUCTOR garantiza que su aportación es original o usa únicamente muestras libres de regalías o debidamente licenciadas. Si un tercero reclamara derechos sobre ella, la responsabilidad de EL PRODUCTOR se limita al monto efectivamente pagado, salvo dolo.

12. ENTREGA: Hasta la liquidación total se entrega únicamente material de revisión (con marca de agua o calidad reducida). Los archivos finales en el formato acordado se entregan solo tras el pago completo.

13. CANCELACIÓN DESPUÉS DE INICIADO EL TRABAJO: Si EL CLIENTE cancela una vez cumplidas las condiciones de la cláusula 4, el anticipo no es reembolsable y cubre el trabajo realizado y la reserva de agenda. Si EL PRODUCTOR cancela sin causa imputable a EL CLIENTE, reembolsará el anticipo en su totalidad.

14. LÍMITE DE RESPONSABILIDAD: La responsabilidad total de EL PRODUCTOR por cualquier reclamo derivado de este acuerdo se limita al monto efectivamente pagado por LA PRODUCCIÓN, salvo dolo.

15. ${CONTRACARGOS}

16. CONFIDENCIALIDAD: Ambas partes mantendrán reserva sobre el material no publicado (beats, letras, grabaciones, fechas de lanzamiento) conocido por este servicio y no lo compartirán con terceros sin autorización de la otra parte.

17. PORTAFOLIO Y CRÉDITOS: EL PRODUCTOR podrá usar fragmentos de LA PRODUCCIÓN en su portafolio, reel o redes únicamente después de su lanzamiento público, o antes si EL CLIENTE lo autoriza por escrito. EL CLIENTE acreditará "Prod. by Arido Music Group" en todas las plataformas donde publique la obra, salvo pacto distinto en la cotización.

18. VIGENCIA Y SUBSISTENCIA: Este acuerdo se extingue cuando LA PRODUCCIÓN haya sido entregada y liquidada. Subsisten después las cláusulas de titularidad, colaboradores, material, originalidad, límite de responsabilidad, confidencialidad y créditos. No se renueva automáticamente ni cubre otra producción.

19. SIN NOVACIÓN: Este acuerdo no deja sin efecto ni modifica los acuerdos que EL CLIENTE haya firmado antes con EL PRODUCTOR sobre otras producciones, ni estos lo modifican a él.

20. FIRMA ELECTRÓNICA Y COPIA: Las partes reconocen que la aceptación de este acuerdo mediante el enlace enviado al correo de EL CLIENTE, con nombre, fecha, dirección IP y dispositivo registrados, es una firma electrónica con efectos vinculantes en términos del Código de Comercio. EL PRODUCTOR enviará a EL CLIENTE copia del acuerdo firmado a ese mismo correo.

21. MENORES DE EDAD: Si EL CLIENTE es menor de edad, este acuerdo deberá ser firmado también por su padre, madre o tutor legal, quien responde solidariamente por las obligaciones aquí contenidas. EL PRODUCTOR podrá pedir identificación para verificarlo.

22. PRIVACIDAD, FUERZA MAYOR Y JURISDICCIÓN: Los datos personales se tratan conforme al Aviso de Privacidad publicado en aridomusicgroup.com/privacidad. Ninguna parte responde por retrasos causados por fuerza mayor (desastres naturales, fallas de plataformas de pago o de entrega, enfermedad grave, entre otras), y los plazos se ajustarán en lo necesario. Las partes se someten a las leyes de los Estados Unidos Mexicanos y a los tribunales competentes del estado de San Luis Potosí.`,
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "10 de noviembre de 2026" — sin depender de la zona horaria del servidor. */
export function fechaLarga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/**
 * El nombre de la producción tal como se cotizó: sus conceptos, unidos.
 * Si no hay conceptos con nombre, cae al folio — el texto nunca queda vacío.
 */
export function tituloDeProduccion(items: Array<{ label?: unknown }>, folio: string): string {
  const labels = items.map((i) => String(i?.label ?? "").trim()).filter(Boolean);
  if (!labels.length) return `la producción de la cotización ${folio}`;
  const unido = labels.join(" + ");
  return unido.length > 140 ? `${unido.slice(0, 137)}...` : unido;
}

/**
 * Rellena todo MENOS `{{cliente}}`, que se pone al firmar con el nombre que
 * escribe quien acepta (mismo comportamiento que los acuerdos por familia).
 */
export function renderProduccion(texto: string, v: VariablesProduccion): string {
  const mapa: Record<string, string> = {
    folio: v.folio,
    fecha_cotizacion: v.fecha_cotizacion,
    titulo: v.titulo,
    rondas_revision: v.rondas_revision || RONDAS_REVISION_DEFAULT,
    plazo_cesion: v.plazo_cesion || PLAZO_CESION_DEFAULT,
  };
  return texto.replace(/\{\{(\w+)\}\}/g, (hueco, clave: string) => (clave in mapa ? mapa[clave] : hueco));
}

/**
 * Huecos `{{x}}` que quedaron sin rellenar (sin contar `{{cliente}}`).
 *
 * Una plantilla editada con un hueco inventado, o una variable que se borró,
 * llegaría al cliente con las llaves a la vista. Se revisa antes de mandar el
 * enlace de firma.
 */
export function huecosSinResolver(textoRenderizado: string): string[] {
  const hallados = new Set<string>();
  for (const m of textoRenderizado.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m[1] !== "cliente") hallados.add(m[1]);
  }
  return [...hallados];
}

/**
 * ¿Esta producción debe nacer "esperando firma"?
 * Solo si la cotización pidió acuerdo individual Y todavía no está firmado.
 */
export const debeBloquearProduccion = (p: { acuerdoIndividual: boolean; firmado: boolean }): boolean =>
  p.acuerdoIndividual && !p.firmado;
