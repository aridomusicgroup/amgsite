import type { Familia } from "./familias";

/**
 * Texto POR DEFECTO (semilla) de cada acuerdo, uno por familia de servicio.
 *
 * Un acuerdo no sirve para todo: el que compra una licencia de $834 ya
 * entregada no puede firmar un anticipo del 50% que nunca aplicó, y un EP de
 * tres meses necesita cláusulas (calendario, coautoría) que un beat suelto no.
 *
 * Son el respaldo si no hay fila editada en `plantillas` (tipo
 * `acuerdo_<familia>`) y lo que se ofrece como "restaurar original". Editable
 * desde /admin/cotizaciones → Plantillas, sin desplegar.
 *
 * `{{cliente}}` es el único campo que se rellena al mostrarse (con el nombre
 * de quien firma). El monto, las fechas y el esquema de pago NO van aquí:
 * viven en la cotización de cada proyecto, que es donde sí existen. Meter una
 * cifra en el acuerdo marco sería prometer un número antes de que exista.
 */

export interface AcuerdoSeed {
  titulo: string;
  cuerpo: string;
}

const ENCABEZADO = (objeto: string): string =>
  `Entre Arido Music Group, en lo sucesivo "EL PRODUCTOR", y {{cliente}}, en lo sucesivo "EL CLIENTE", se celebra el presente acuerdo para ${objeto}, al tenor de las siguientes cláusulas:`;

// Cláusulas que se repiten igual en varias familias, para no reescribirlas
// cuatro veces y arriesgar que una copia se desalinee de las otras al editar.
const CONTRACARGOS = `CONTRACARGOS: Ante cualquier inconformidad, EL CLIENTE se obliga a notificarla por escrito a EL PRODUCTOR y a conceder un plazo de 5 días hábiles para resolverla, antes de iniciar un contracargo o reversión de pago vía Stripe, PayPal o entidad bancaria. El contracargo iniciado sin agotar este paso será considerado incumplimiento grave y obligará a EL CLIENTE a cubrir los gastos legales y administrativos que genere.`;

const DECLARACIONES_PUBLICAS = `DECLARACIONES PÚBLICAS: EL CLIENTE se compromete a no difundir declaraciones falsas o difamatorias sobre EL PRODUCTOR. Esta cláusula no limita el derecho de EL CLIENTE a expresar públicamente su opinión honesta sobre el servicio recibido.`;

const MENORES = `MENORES DE EDAD: Si EL CLIENTE es menor de edad, este acuerdo deberá ser firmado también por su padre, madre o tutor legal, quien responde solidariamente por las obligaciones aquí contenidas. EL PRODUCTOR podrá pedir identificación para verificarlo.`;

const CONFIDENCIALIDAD = `CONFIDENCIALIDAD: Ambas partes se obligan a mantener reserva sobre el material aún no publicado (beats, letras, grabaciones, fechas de lanzamiento) del que tengan conocimiento por este servicio, y a no compartirlo con terceros sin autorización de la otra parte.`;

const PORTAFOLIO = `USO EN PORTAFOLIO: EL PRODUCTOR podrá usar fragmentos del trabajo realizado (incluido antes de su lanzamiento público, si el cliente lo autoriza por escrito) como muestra de su trabajo en su portafolio, reel o redes, salvo que EL CLIENTE lo restrinja expresamente por escrito.`;

const FIRMA_ELECTRONICA = `FIRMA ELECTRÓNICA: Las partes reconocen que la aceptación de este acuerdo a través del panel de cliente de Arido Music Group, con nombre, fecha, IP y dispositivo registrados, constituye una firma electrónica válida y vinculante en términos del Código de Comercio.`;

const FUERZA_MAYOR = `FUERZA MAYOR: Ninguna de las partes será responsable por retrasos o incumplimientos derivados de causas fuera de su control razonable (desastres naturales, fallas de plataformas de pago o de entrega, enfermedad grave, entre otras), en cuyo caso los plazos se ajustarán en la medida necesaria.`;

const PRIVACIDAD = `PRIVACIDAD: Los datos personales que EL CLIENTE proporcione (nombre, correo, teléfono, dirección) se usan para operar este servicio y se tratan conforme al Aviso de Privacidad publicado en aridomusicgroup.com/privacidad.`;

const JURISDICCION = `JURISDICCIÓN: Las partes se someten a las leyes de los Estados Unidos Mexicanos y a los tribunales competentes del estado de San Luis Potosí.`;

const REMISION_COTIZACION = `El alcance, el monto, el esquema de pago y las fechas de este proyecto se detallan en su cotización particular, que se rige por estas cláusulas. En caso de diferencia entre ambos documentos, prevalece lo pactado en la cotización.`;

// ── C · Beat personalizado ──────────────────────────────────────────────────
const PERSONALIZADO: AcuerdoSeed = {
  titulo: "Acuerdo de beat personalizado, con anticipo y reserva de agenda",
  cuerpo: `${ENCABEZADO("la creación de un beat musical personalizado")}

${REMISION_COTIZACION}

1. OBJETO: EL PRODUCTOR se obliga a crear un beat musical personalizado conforme a las especificaciones creativas acordadas con EL CLIENTE. Cuando el servicio incluya la escritura de la letra ("BP + Letra"), la autoría de la composición y el porcentaje editorial que corresponda a cada parte se definen expresamente en la cotización de ese proyecto.

2. MONTO Y FORMA DE PAGO: EL CLIENTE pagará un anticipo del 50% para reservar agenda, no reembolsable, y el saldo antes de la entrega final — salvo que la cotización indique un esquema de pago distinto.

3. PLAZOS Y REVISIONES: El plazo de entrega es el indicado en la cotización y empieza a correr cuando se hayan cumplido dos condiciones: recibido el anticipo y recibida por escrito la información creativa necesaria (brief, referencias). El plazo se suspende mientras EL PRODUCTOR espere respuesta, aprobación o materiales de EL CLIENTE, y se reanuda al recibirlos. El servicio incluye 2 rondas de revisión; las adicionales, o los cambios que modifiquen lo acordado originalmente, se cotizan por separado.

4. CESIÓN CONDICIONADA: Los derechos patrimoniales del beat serán cedidos únicamente tras el pago total. Hasta entonces, EL PRODUCTOR conserva la titularidad completa.

5. PROPIEDAD INTELECTUAL: EL CLIENTE no podrá distribuir, monetizar, registrar ni explotar el beat sin haber liquidado el 100% del monto pactado.

6. ENTREGA: Hasta la liquidación total se entrega únicamente material de revisión con limitaciones (marca de agua o baja calidad). El archivo WAV final sin restricciones —y los STEMS, si la cotización los incluye— se entrega solo tras el pago completo.

7. ORIGINALIDAD DEL BEAT: EL PRODUCTOR garantiza que el beat es de su autoría original o usa únicamente muestras (samples) libres de regalías o debidamente licenciadas. Si un tercero reclamara derechos sobre el beat entregado, la responsabilidad de EL PRODUCTOR frente a EL CLIENTE se limita al monto efectivamente pagado por ese beat.

8. PENALIZACIÓN POR USO INDEBIDO: En caso de uso, distribución o monetización sin haber liquidado, EL CLIENTE pagará como pena convencional el precio de la licencia exclusiva vigente de ese beat o tres veces el monto pagado, lo que resulte mayor, más los daños y perjuicios que se acrediten.

9. MORA Y SUSPENSIÓN: En caso de retraso en el pago se aplicará un interés moratorio del 3% mensual sobre el saldo pendiente. Mientras exista saldo vencido, EL PRODUCTOR suspenderá la producción y la entrega de archivos, y la fecha compromiso se recorrerá en la misma medida.

10. RESOLUCIÓN AUTOMÁTICA: El incumplimiento de pago por más de 30 días facultará a EL PRODUCTOR a rescindir el acuerdo automáticamente, conservando el anticipo y pudiendo disponer libremente del beat.

11. CANCELACIÓN: Si EL CLIENTE cancela antes de la entrega, el anticipo no es reembolsable y cubre el trabajo ya realizado y la reserva de agenda. Si EL PRODUCTOR cancela sin causa imputable a EL CLIENTE, reembolsará el anticipo en su totalidad.

12. CONSERVACIÓN DE ARCHIVOS: EL PRODUCTOR conservará una copia de los archivos finales durante 12 meses contados desde la entrega. Pasado ese plazo, no está obligado a conservarlos.

13. ${CONTRACARGOS}

14. ${DECLARACIONES_PUBLICAS}

15. CRÉDITOS: EL CLIENTE deberá acreditar "Prod. by Arido Music Group" en todas las plataformas donde publique la obra.

16. ${PORTAFOLIO}

17. ${CONFIDENCIALIDAD}

18. ${MENORES}

19. ${PRIVACIDAD}

20. ${FIRMA_ELECTRONICA}

21. ${FUERZA_MAYOR}

22. ${JURISDICCION}`,
};

// ── D · Grabación, mezcla y master ──────────────────────────────────────────
const SERVICIO: AcuerdoSeed = {
  titulo: "Acuerdo de grabación, mezcla y master",
  cuerpo: `${ENCABEZADO("servicios de grabación, mezcla y/o masterización sobre material de EL CLIENTE")}

${REMISION_COTIZACION}

1. OBJETO: EL PRODUCTOR presta servicios técnicos de grabación, mezcla y/o masterización sobre voz, instrumentos u obras que EL CLIENTE aporta. A diferencia de un beat personalizado, aquí EL PRODUCTOR no cede derechos de autor: presta un servicio técnico sobre material que ya pertenece a EL CLIENTE.

2. MONTO Y FORMA DE PAGO: EL CLIENTE pagará un anticipo del 50% para reservar agenda, no reembolsable, y el saldo antes de la entrega final — salvo que la cotización indique un esquema de pago distinto.

3. PLAZOS Y REVISIONES: El plazo de entrega es el indicado en la cotización y empieza a correr cuando EL PRODUCTOR reciba el anticipo y el material completo a trabajar (voces, referencias, instrucciones). El plazo se suspende mientras se espere material o respuesta de EL CLIENTE. El servicio incluye 2 rondas de revisión; las adicionales se cotizan por separado.

4. GARANTÍA DE EL CLIENTE: EL CLIENTE declara que el material que entrega (voz, letra, samples propios) es de su autoría o cuenta con los permisos necesarios para usarlo, y responde frente a cualquier reclamo de terceros derivado de ese material.

5. ENTREGA: Los archivos de trabajo (roughs, mezclas preliminares) se entregan para revisión; los archivos finales en el formato acordado se entregan solo tras el pago completo.

6. MORA Y SUSPENSIÓN: En caso de retraso en el pago se aplicará un interés moratorio del 3% mensual sobre el saldo pendiente. Mientras exista saldo vencido, EL PRODUCTOR suspenderá el servicio y la entrega de archivos.

7. RESOLUCIÓN AUTOMÁTICA: El incumplimiento de pago por más de 30 días facultará a EL PRODUCTOR a rescindir el acuerdo automáticamente, conservando el anticipo.

8. CANCELACIÓN: Si EL CLIENTE cancela antes de la entrega, el anticipo no es reembolsable y cubre el trabajo ya realizado. Si EL PRODUCTOR cancela sin causa imputable a EL CLIENTE, reembolsará el anticipo en su totalidad.

9. LÍMITE DE RESPONSABILIDAD: La responsabilidad total de EL PRODUCTOR frente a EL CLIENTE por cualquier reclamo derivado de este servicio se limita al monto efectivamente pagado por él.

10. CONSERVACIÓN DE ARCHIVOS: EL PRODUCTOR conservará una copia de los archivos finales durante 12 meses contados desde la entrega. Pasado ese plazo, no está obligado a conservarlos.

11. ${CONTRACARGOS}

12. ${DECLARACIONES_PUBLICAS}

13. CRÉDITOS: EL CLIENTE deberá acreditar "Mixed/Mastered by Arido Music Group" (según el servicio) en las plataformas donde publique la obra, salvo acuerdo distinto en la cotización.

14. ${PORTAFOLIO}

15. ${CONFIDENCIALIDAD}

16. ${MENORES}

17. ${PRIVACIDAD}

18. ${FIRMA_ELECTRONICA}

19. ${FUERZA_MAYOR}

20. ${JURISDICCION}`,
};

// ── E · EP / Álbum ───────────────────────────────────────────────────────────
const EP_ALBUM: AcuerdoSeed = {
  titulo: "Acuerdo de producción de EP o álbum",
  cuerpo: `${ENCABEZADO("la producción de un EP o álbum de varias canciones")}

${REMISION_COTIZACION} El esquema de pago de este proyecto es alguno de los siguientes, según se indique en la cotización: (a) estándar, 50% al inicio y 50% antes de la entrega; (b) por etapas, dividido en avances del proyecto; (c) por canción entregada; (d) en mensualidades iguales; o (e) de contado. La cotización precisa cuál aplica y sus montos.

1. OBJETO: EL PRODUCTOR se obliga a producir el conjunto de canciones (beats, y cuando se incluya, grabación, mezcla y masterización) que integran el EP o álbum descrito en la cotización, conforme al calendario ahí acordado.

2. COAUTORÍA: Cuando EL PRODUCTOR participe en la composición (letra o melodía) de alguna canción, la autoría y el porcentaje editorial que corresponda a cada parte se definen canción por canción en la cotización o en un anexo firmado por ambas partes.

3. ENTREGABLES Y CALENDARIO: El proyecto se entrega por canción, conforme al calendario de la cotización. El plazo de cada entrega se suspende mientras EL PRODUCTOR espere material, aprobación o pago de una etapa por parte de EL CLIENTE.

4. REVISIONES: Cada canción incluye 2 rondas de revisión. Las adicionales, o los cambios que modifiquen lo acordado originalmente para esa canción, se cotizan por separado.

5. CESIÓN CONDICIONADA: Los derechos patrimoniales de cada canción se ceden únicamente cuando esa etapa de pago correspondiente esté liquidada, o al liquidar el total del proyecto si la cotización así lo establece.

6. PROPIEDAD INTELECTUAL: EL CLIENTE no podrá distribuir, monetizar ni registrar una canción cuya etapa de pago correspondiente no esté liquidada.

7. ORIGINALIDAD: EL PRODUCTOR garantiza que los beats son de su autoría original o usan únicamente muestras libres de regalías o debidamente licenciadas. Su responsabilidad frente a cualquier reclamo de terceros se limita al monto pagado por la canción afectada.

8. MORA Y SUSPENSIÓN: En caso de retraso en el pago de cualquier etapa se aplicará un interés moratorio del 3% mensual sobre lo vencido. Mientras exista saldo vencido, EL PRODUCTOR suspenderá el trabajo en las canciones pendientes.

9. RESOLUCIÓN AUTOMÁTICA Y CANCELACIÓN: El incumplimiento de pago de una etapa por más de 30 días faculta a EL PRODUCTOR a suspender el proyecto y conservar lo ya pagado por las canciones entregadas. Si EL CLIENTE cancela el proyecto, conserva las canciones ya liquidadas en los términos de la cláusula 5; lo pagado por etapas no iniciadas se reembolsa. Si EL PRODUCTOR cancela sin causa imputable a EL CLIENTE, reembolsará lo pagado por las canciones no entregadas.

10. CONSERVACIÓN DE ARCHIVOS: EL PRODUCTOR conservará una copia de los archivos finales de cada canción durante 12 meses contados desde su entrega.

11. ${CONTRACARGOS}

12. ${DECLARACIONES_PUBLICAS}

13. CRÉDITOS: EL CLIENTE deberá acreditar "Prod. by Arido Music Group" en todas las plataformas donde publique cada canción.

14. ${PORTAFOLIO}

15. ${CONFIDENCIALIDAD}

16. ${MENORES}

17. ${PRIVACIDAD}

18. ${FIRMA_ELECTRONICA}

19. ${FUERZA_MAYOR}

20. ${JURISDICCION}`,
};

// ── A · Licencia de catálogo ─────────────────────────────────────────────────
// Deliberadamente corta: quien paga $25–$100 y descarga al instante no puede
// toparse con veinte cláusulas. Hoy vive aquí solo como semilla — falta
// mostrarla en el checkout (fase 5 del plan); no se usa todavía en ninguna
// pantalla.
const LICENCIA: AcuerdoSeed = {
  titulo: "Términos de la licencia",
  cuerpo: `${ENCABEZADO("la licencia de uso de un beat del catálogo de Arido Music Group")}

1. La licencia adquirida (Básica, Premium o Premium Plus) define los archivos entregados y los usos permitidos, según se describe en cada beat al momento de la compra.

2. El beat es una obra protegida por derechos de autor. Esta licencia NO transfiere la propiedad ni exclusividad: EL PRODUCTOR puede licenciarlo a otras personas.

3. EL PRODUCTOR garantiza que el beat es de su autoría original o usa únicamente muestras libres de regalías o debidamente licenciadas.

4. EL CLIENTE debe acreditar "Prod. by Arido Music Group" al publicar la obra, salvo en la licencia Exclusiva.

5. ${PRIVACIDAD}

6. ${JURISDICCION}`,
};

// ── B · Exclusiva ─────────────────────────────────────────────────────────
// Igual que A: semilla lista, falta engancharla al flujo de compra/negociación
// de exclusividad (fase 5).
const EXCLUSIVA: AcuerdoSeed = {
  titulo: "Acuerdo de cesión de exclusividad",
  cuerpo: `${ENCABEZADO("la cesión de exclusividad de un beat")}

${REMISION_COTIZACION}

1. CESIÓN: Tras el pago completo, EL PRODUCTOR cede a EL CLIENTE los derechos patrimoniales exclusivos del beat descrito en la cotización, y retira el beat de venta en cualquier otra plataforma o canal.

2. LO QUE NO SE CEDE: EL PRODUCTOR conserva su derecho moral de autor y podrá usar el beat en su portafolio bajo los términos de la cláusula de portafolio de este acuerdo, salvo que EL CLIENTE lo restrinja expresamente por escrito.

3. ORIGINALIDAD: EL PRODUCTOR garantiza que el beat es de su autoría original o usa únicamente muestras libres de regalías o debidamente licenciadas. Su responsabilidad frente a cualquier reclamo de terceros se limita al monto pagado.

4. CRÉDITOS: Negociables y se definen en la cotización de cada exclusiva.

5. ${CONTRACARGOS}

6. ${PORTAFOLIO}

7. ${PRIVACIDAD}

8. ${FIRMA_ELECTRONICA}

9. ${JURISDICCION}`,
};

export const SEEDS: Record<Familia, AcuerdoSeed> = {
  licencia: LICENCIA,
  exclusiva: EXCLUSIVA,
  personalizado: PERSONALIZADO,
  servicio: SERVICIO,
  ep_album: EP_ALBUM,
};
