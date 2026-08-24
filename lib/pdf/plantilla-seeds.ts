import { ContractTipo } from "./contracts/types";

/**
 * Textos POR DEFECTO (semilla) de cada plantilla. Son el respaldo si no hay fila
 * editada en la DB, y lo que se ofrece como "restaurar original". Fieles a los
 * contratos/cotización que ya se generaban antes de hacerlos editables.
 */

export interface PlantillaSeed {
  titulo: string;
  cuerpo: string;
}

// Nota: las firmas las dibuja el motor (no van en el cuerpo editable).

const DECLARA_CLAUSULAS_COMUN = `# DECLARACIONES

I. DECLARA "EL VENDEDOR":

1. Que para los efectos del presente acuerdo señala como su domicilio legal el ubicado en Aramberri #1701, La Finca, Matehuala, San Luis Potosí, C.P. 78700, con Tel 52 488 178 0213, correo-e: latinogangbeats@gmail.com

2. Que es su entera voluntad y deseo realizar LA COMPOSICIÓN MUSICAL que "EL COMPRADOR" le encomiende, la cual en lo sucesivo se denominará {{obra}}.

II. DECLARA "EL COMPRADOR":

1. Que para los efectos del presente acuerdo señala como su domicilio legal el ubicado en {{cliente_direccion}}, con Tel. {{cliente_telefono}}, correo-e: {{cliente_email}}.

2. Que es su entera voluntad y deseo realizar el encargo y la compra de LA COMPOSICIÓN MUSICAL de "EL VENDEDOR", la cual tiene como nombre {{obra}}.

III. DECLARAN LAS PARTES

ÚNICA: Que, leídas las anteriores declaraciones, reconocen mutuamente la voluntad y la capacidad jurídica, conviniendo en celebrar el presente acuerdo al tenor de las siguientes:`;

// Cláusulas 3ª–9ª compartidas por Exclusiva y Beat personalizado (idénticas).
const CLAUSULAS_3_A_9 = `TERCERA. "EL COMPRADOR" manifiesta su voluntad aceptando el valor de la instrumental. "EL VENDEDOR" manifiesta su voluntad aceptando el pago mencionado en la cláusula anterior.

CUARTA. Desde el momento de su creación, la instrumental (entendiéndose esta como el producto final de la grabación, excluyendo de manera expresa la composición musical subyacente) será considerada como un "trabajo hecho por encargo" a favor de "EL COMPRADOR", bajo los términos y condiciones acordados entre las partes.

QUINTA. "EL COMPRADOR" gozará del derecho exclusivo, perpetuo y aplicable en todo el universo para:

- Fabricar, promocionar, vender, licenciar o disponer de la instrumental y cualquier obra derivada de ella en el formato o medio que "EL COMPRADOR" decida, ya sea presente o futuro.
- Interpretar públicamente la instrumental y autorizar su ejecución pública a través de cualquier método existente o por desarrollarse en el futuro.
- Incorporar la interpretación sonora de "EL VENDEDOR" en producciones audiovisuales ("Video").

No obstante, el comprador no tendrá derecho a:

- Realizar modificaciones estructurales o de autoría que alteren la melodía, armonía o progresión de acordes de la composición original creada por el Productor. Se autorizan de forma explícita las modificaciones de carácter técnico y de ingeniería de audio, tales como mezcla, masterización, ecualización, adición de efectos y ajustes menores de arreglo en los canales individuales (stems) provistos, siempre y cuando no se mutile o desvirtúe la esencia de la obra original.
- Utilizar la composición de "EL VENDEDOR" de forma separada de la instrumental.
- Emplear la composición de "EL VENDEDOR" de manera que sugiera o implique respaldo, apoyo o asociación con cualquier otra entidad o actividad.

SEXTA. "EL COMPRADOR" estará facultado para utilizar el nombre, imagen y materiales biográficos de "EL VENDEDOR", siempre y cuando estos hayan sido previamente aprobados por el propio "VENDEDOR", y únicamente en lo relacionado con la instrumental y sus derivados.

El crédito correspondiente a "EL VENDEDOR" deberá otorgarse de manera visible y adecuada, reflejando sustancialmente la siguiente forma: "Producido por {{vendedor}}", o cualquier otra designación similar que sea mutuamente acordada por las partes, garantizando un reconocimiento proporcional a su contribución dentro de las obras o materiales en cuestión.

SEPTIMA. "EL VENDEDOR" se deslinda de cualquier responsabilidad legal que pudiese resultar por el uso de la instrumental, a partir de la firma del presente contrato.

OCTAVA. El cobro de las regalías derivadas de cualquier fuente, siempre que se encuentren dentro del marco legal aplicable, será de exclusiva titularidad de "EL COMPRADOR". En consecuencia, "EL VENDEDOR" renuncia irrevocablemente a cualquier derecho de reclamar regalías relacionadas con la obra instrumental {{obra}}, deslindando por completo a "EL COMPRADOR" de cualquier reclamo relacionado con derechos de autor, regalías u otras situaciones vinculadas a la instrumental mencionada.

NOVENA. Declaran ambas partes que en la celebración del presente acuerdo no existe error, dolo, violencia o mala fe que pudieran invalidarlo. Ratificando la voluntad de las partes citadas en la DECLARACIÓN TERCERA del presente acuerdo.

Previa lectura al presente acuerdo, las partes aceptan quedar obligadas en todos los términos y condiciones, las cuales firman de conformidad en dos tantos, el {{fecha}}.`;

const intro = (rol: string) =>
  `ACUERDO DE PRODUCCIÓN MUSICAL QUE CELEBRAN POR UNA PARTE LOS C. AHMED ELIUD LÓPEZ CONTRERAS Y LUIS ALBERTO ROCHA ORNELAS, A LA QUE EN LO SUCESIVO SE DENOMINARÁ "EL VENDEDOR"; Y POR LA OTRA PARTE EL C. {{cliente}} A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ "${rol}", AL TENOR DE LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS:`;

export const SEEDS: Record<ContractTipo, PlantillaSeed> = {
  beat_personalizado: {
    titulo: "ACUERDO DE PRODUCCIÓN MUSICAL",
    cuerpo: `${intro('"EL COMPRADOR"')}

${DECLARA_CLAUSULAS_COMUN}

# CLÁUSULAS

PRIMERA. El presente acuerdo tiene como objeto la compraventa de la instrumental {{obra}} citada en la SEGUNDA DECLARACIÓN del presente acuerdo.

SEGUNDA. El precio de compraventa de la instrumental será de {{monto}} (MONEDA NACIONAL), el cual será cubierto de la siguiente manera:

- UN (1) PAGO POR MEDIO DE TRANSFERENCIA ELECTRÓNICA BANCARIA DE {{monto}} AL MOMENTO DE LA FIRMA DEL PRESENTE CONTRATO.

${CLAUSULAS_3_A_9}`,
  },

  exclusiva: {
    titulo: "ACUERDO DE PRODUCCIÓN MUSICAL",
    cuerpo: `${intro('"EL COMPRADOR"')}

${DECLARA_CLAUSULAS_COMUN}

# CLÁUSULAS

PRIMERA. El presente acuerdo tiene como objeto la compraventa de la instrumental {{obra}} citada en la SEGUNDA DECLARACIÓN del presente acuerdo.

SEGUNDA. El precio de compraventa de la instrumental será de {{monto}}, el cual será cubierto de la siguiente manera:

- UN (1) PAGO POR MEDIO DE PAGO ELECTRÓNICO (TARJETA / TRANSFERENCIA) DE {{monto}} AL MOMENTO DE LA FIRMA DEL PRESENTE CONTRATO.

${CLAUSULAS_3_A_9}`,
  },

  produccion: {
    titulo: "CONTRATO DE PRODUCCIÓN MUSICAL",
    cuerpo: `Contrato de producción musical a la medida que celebran, por una parte, {{vendedor}} (Árido Music Group / Latino Gang Beats), en adelante "EL PRODUCTOR"; y por la otra, {{cliente}} (Tel. {{cliente_telefono}}, correo-e {{cliente_email}}), en adelante "EL CLIENTE", conforme a las siguientes cláusulas:

PRIMERA. OBJETO. "EL PRODUCTOR" se obliga a realizar para "EL CLIENTE" la producción musical a la medida denominada "{{obra}}", conforme a las especificaciones, género y referencias acordadas entre las partes.

SEGUNDA. PRECIO Y FORMA DE PAGO. El precio total de la producción es de {{monto}}. Salvo pacto distinto por escrito, se cubrirá con un anticipo para iniciar el trabajo y el finiquito contra la entrega de los archivos finales.

TERCERA. ENTREGABLES Y REVISIONES. La producción incluye 2 (dos) rondas de revisiones sin costo. Ajustes o servicios adicionales fuera del alcance acordado se cotizarán por separado.

CUARTA. PLAZO. El tiempo de entrega se confirma al arrancar el proyecto y está sujeto a que "EL CLIENTE" entregue en tiempo los materiales necesarios (letra, referencias, tonalidad, tomas de voz, etc.).

QUINTA. DERECHOS. Una vez cubierto el pago total, la grabación resultante se considera un "trabajo hecho por encargo" a favor de "EL CLIENTE", quien podrá explotarla comercialmente. "EL PRODUCTOR" conserva el derecho de ser acreditado por su trabajo de producción.

SEXTA. CRÉDITO. En las obras derivadas, "EL CLIENTE" otorgará el crédito de producción de forma visible, sustancialmente como: "Producido por {{vendedor}}".

SÉPTIMA. RESPONSABILIDAD DEL CLIENTE. "EL CLIENTE" es responsable del contenido y materiales que aporte, y manifiesta contar con los derechos necesarios sobre los mismos.

OCTAVA. BUENA FE. Las partes manifiestan que no existe error, dolo, violencia ni mala fe, y aceptan obligarse en todos sus términos, firmando de conformidad el {{fecha}}.`,
  },

  servicio: {
    titulo: "CONTRATO DE PRESTACIÓN DE SERVICIOS",
    cuerpo: `Contrato de prestación de servicios que celebran, por una parte, {{vendedor}} (Árido Music Group / Latino Gang Beats), en adelante "EL PRESTADOR"; y por la otra, {{cliente}} (Tel. {{cliente_telefono}}, correo-e {{cliente_email}}), en adelante "EL CLIENTE", conforme a las siguientes cláusulas:

PRIMERA. OBJETO. "EL PRESTADOR" se obliga a realizar para "EL CLIENTE" el servicio de "{{obra}}", conforme a los materiales y especificaciones que "EL CLIENTE" proporcione.

SEGUNDA. PRECIO Y FORMA DE PAGO. El precio del servicio es de {{monto}}, pagadero por transferencia o pago electrónico conforme a lo acordado.

TERCERA. ALCANCE Y REVISIONES. El servicio incluye 2 (dos) rondas de revisiones sin costo. Cambios fuera del alcance acordado se cotizarán por separado.

CUARTA. MATERIALES Y PLAZO. "EL CLIENTE" entregará los materiales necesarios (stems, tomas, referencias). El plazo de entrega se confirma al recibir dichos materiales completos.

QUINTA. DERECHOS. "EL PRESTADOR" realiza un servicio técnico sobre la obra de "EL CLIENTE" y no adquiere ningún derecho de autor ni de explotación sobre la misma.

SEXTA. RESPONSABILIDAD DEL CLIENTE. "EL CLIENTE" es responsable del contenido y materiales que aporte, y manifiesta contar con los derechos necesarios sobre los mismos.

SÉPTIMA. BUENA FE. Las partes manifiestan que no existe error, dolo, violencia ni mala fe, y aceptan obligarse en todos los términos, firmando de conformidad el {{fecha}}.`,
  },

  ep_album: {
    titulo: "CONTRATO DE PRODUCCIÓN DE EP / ÁLBUM",
    cuerpo: `Contrato de producción musical de EP/álbum que celebran, por una parte, {{vendedor}} (Árido Music Group / Latino Gang Beats), en adelante "EL PRODUCTOR"; y por la otra, {{cliente}} (Tel. {{cliente_telefono}}, correo-e {{cliente_email}}), en adelante "EL CLIENTE", conforme a las siguientes cláusulas:

PRIMERA. OBJETO. "EL PRODUCTOR" se obliga a realizar para "EL CLIENTE" la producción del proyecto "{{obra}}" (EP/álbum de varias canciones), conforme a las especificaciones, género y referencias acordadas entre las partes.

SEGUNDA. PRECIO Y FORMA DE PAGO. El precio total del proyecto es de {{monto}}, cubierto conforme al esquema de pago detallado en la cotización de este proyecto.

TERCERA. ENTREGABLES Y REVISIONES. Cada canción del proyecto incluye 2 (dos) rondas de revisiones sin costo. Ajustes o servicios adicionales fuera del alcance acordado se cotizarán por separado.

CUARTA. PLAZO Y ENTREGA POR CANCIÓN. El tiempo de entrega de cada canción se confirma al recibir los materiales necesarios de "EL CLIENTE" para esa canción (letra, referencias, tonalidad, tomas de voz, etc.). El proyecto se entrega por canción conforme avanza, salvo acuerdo distinto por escrito.

QUINTA. DERECHOS. Una vez cubierto el pago total del proyecto, las grabaciones resultantes se consideran un "trabajo hecho por encargo" a favor de "EL CLIENTE", quien podrá explotarlas comercialmente. "EL PRODUCTOR" conserva el derecho de ser acreditado por su trabajo de producción.

SEXTA. CRÉDITO. En cada canción del proyecto, "EL CLIENTE" otorgará el crédito de producción de forma visible, sustancialmente como: "Producido por {{vendedor}}".

SÉPTIMA. RESPONSABILIDAD DEL CLIENTE. "EL CLIENTE" es responsable del contenido y materiales que aporte para cada canción, y manifiesta contar con los derechos necesarios sobre los mismos.

OCTAVA. BUENA FE. Las partes manifiestan que no existe error, dolo, violencia ni mala fe, y aceptan obligarse en todos sus términos, firmando de conformidad el {{fecha}}.`,
  },

  generico: {
    titulo: "CONTRATO",
    cuerpo: `Contrato que celebran, por una parte, {{vendedor}} (Árido Music Group / Latino Gang Beats), en adelante "ÁRIDO"; y por la otra, {{cliente}} (Tel. {{cliente_telefono}}, correo-e {{cliente_email}}), en adelante "EL CLIENTE", conforme a lo siguiente:

OBJETO. {{obra}}.

MONTO. {{monto}}.

# CLÁUSULAS

PRIMERA. (Edita aquí las cláusulas de este contrato.)

Las partes aceptan obligarse en todos los términos anteriores, firmando de conformidad el {{fecha}}.`,
  },
};

/** Términos por defecto del pie de la cotización (editable). */
export const COTIZACION_TERMINOS_SEED =
  `Precios en {{moneda}}. Incluye 2 rondas de revisiones por servicio; ajustes adicionales se cotizan aparte. ` +
  `El tiempo de entrega se confirma al arrancar el proyecto. Para apartar, avísanos y te compartimos el enlace de pago. ` +
  `Contacto: WhatsApp +52 488 178 0213 · latinogangbeats@gmail.com · aridomusicgroup.com`;
