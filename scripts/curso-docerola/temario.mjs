// Temario del curso "Docerola Tumbada": ÚNICA fuente de la plantilla.
// De aquí salen el seed SQL (generar-seed.mjs) y la copia en Word.
// Los títulos son reales; todo lo que va entre [RELLENAR: …] lo completa el
// maestro con sus palabras desde el panel (/admin/cursos → Guion).

const R = (s) => `[RELLENAR: ${s}]`;

/** Lección núcleo / herramienta / profunda: ciclo Mínimo → Práctica → Criterio. */
const nucleo = (titulo, h, extra = {}) => ({
  titulo,
  tipo: "video",
  etiqueta: extra.etiqueta ?? "nucleo",
  opcional: extra.opcional ?? false,
  preview: extra.preview ?? false,
  cta: extra.cta ?? "ninguno",
  contenido: {
    objetivo: R(h.objetivo ?? "“Al terminar podrás…”: qué toca el alumno al final y a qué tempo"),
    gancho: R(h.gancho ?? "el pasaje que tocas en los primeros 30 s para enseñar a dónde va a llegar"),
    minimo: R(h.minimo ?? "la teoría mínima para tocar esto: 1 a 3 ideas + una analogía tuya"),
    practica: R(h.practica ?? "pasos, digitación y tempo: lento → 0.5x → tempo real"),
    criterio: R(h.criterio ?? "cuándo sí, cuándo no y por qué suena a corrido; rola de ejemplo y error común"),
    reto: R(h.reto ?? "tarea medible: tempo meta, repeticiones limpias o grabarse"),
    puente: R(h.puente ?? "adelanto de la siguiente lección en una frase"),
    ...(extra.cta && extra.cta !== "ninguno" ? { cta_texto: R(extra.ctaTexto ?? "el llamado con tus palabras") } : {}),
  },
});

const herramienta = (titulo, h, extra = {}) => nucleo(titulo, h, { ...extra, etiqueta: "herramienta" });
const profunda = (titulo, h) => nucleo(titulo, h, { etiqueta: "profunda", opcional: true });

/** Dato Crack: cápsula vertical 9:16 de 30–45 s (también sirve como Reel). */
const capsula = (titulo, h) => ({
  titulo,
  tipo: "video",
  etiqueta: "capsula",
  opcional: true,
  contenido: {
    dato: R(h.dato),
    explicacion: R(h.explicacion),
    aplicacion: R(h.aplicacion),
    fuente: R(h.fuente ?? "dónde se verifica el dato (libro, fabricante, artículo) — no se le muestra al alumno"),
  },
});

/** Cierre filosófico de módulo (2–4 min). Cuenta para la ruta principal. */
const filosofia = (titulo, h, extra = {}) => ({
  titulo,
  tipo: "video",
  etiqueta: "filosofia",
  opcional: false,
  cta: extra.cta ?? "ninguno",
  contenido: {
    idea: R(h.idea),
    historia_personal: R(h.historia),
    pregunta_al_alumno: R(h.pregunta),
    ...(extra.cta ? { cta_texto: R(extra.ctaTexto ?? "el llamado con tus palabras") } : {}),
  },
});

const RUBRICA_E1 = [
  { criterio: "Tempo y pulso", niveles: [R("se acelera o se frena"), R("aguanta el tempo con tropiezos"), R("estable a tempo meta"), R("pulso de disco, con groove")] },
  { criterio: "Limpieza", niveles: [R("cuerdas que zumban o no suenan"), R("limpio en lo lento"), R("limpio a tempo"), R("limpio y con control del apagado")] },
  { criterio: "Fidelidad de la frase", niveles: [R("se pierde la melodía"), R("se reconoce la frase"), R("frase completa y correcta"), R("frase con los adornos del original")] },
  { criterio: "Sonido y dinámica", niveles: [R("todo al mismo volumen"), R("algo de contraste"), R("dinámica intencional"), R("suena a grabación profesional")] },
];

const RUBRICA_E2 = [
  { criterio: "Coherencia armónica", niveles: [R("notas que chocan"), R("funciona con choques ocasionales"), R("todo encaja con la armonía"), R("usa tensiones a propósito")] },
  { criterio: "Fraseo y estilo tumbado", niveles: [R("no suena a corrido"), R("se reconoce el género"), R("suena a corrido tumbado actual"), R("tiene sello propio dentro del estilo")] },
  { criterio: "Técnica", niveles: [R("errores que distraen"), R("ejecución aceptable"), R("ejecución limpia"), R("técnica al servicio de la rola")] },
  { criterio: "Identidad", niveles: [R("copia literal"), R("variación de algo conocido"), R("ideas propias"), R("se reconoce quién lo tocó")] },
  { criterio: "Criterio explicado", niveles: [R("no explica sus decisiones"), R("explica qué hizo"), R("explica por qué"), R("explica alternativas que descartó y por qué")] },
];

const evaluacion = (titulo, h, extra = {}) => ({
  titulo,
  tipo: extra.tipo ?? "entrega",
  etiqueta: "evaluacion",
  opcional: true,
  cta: extra.cta ?? "ninguno",
  contenido: {
    instrucciones: R(h.instrucciones),
    entregables: R(h.entregables),
    ...(extra.rubrica ? { rubrica: extra.rubrica } : {}),
    ...(extra.cta ? { cta_texto: R(extra.ctaTexto ?? "el llamado con tus palabras") } : {}),
  },
});

const quiz = (titulo, h, preguntas, extra = {}) => ({
  titulo,
  tipo: "quiz",
  etiqueta: "evaluacion",
  opcional: true,
  contenido: {
    instrucciones: R(h.instrucciones),
    preguntas,
    ...(extra.diagnostico ? { diagnostico: extra.diagnostico } : {}),
  },
});

export const CURSO = {
  slug: "docerola-tumbada",
  titulo: "Docerola Tumbada",
  descripcion:
    "Del primer rasgueo al requinto propio: aprende docerola para corridos tumbados con criterio, sin depender de tutoriales.",
  revisiones_incluidas: 1,
  config: {
    meta_semanal_min: 150,
    landing: {
      promesa: R("qué va a poder tocar el alumno al terminar, en una o dos frases (ej. rasgueo tumbado, su propio requinto y criterio para sacar cualquier rola)"),
      para_quien: R("un punto por renglón: para quién SÍ es el curso"),
      no_para_quien: R("un punto por renglón: para quién NO es (filtra a quien busca atajos)"),
      garantia: R("tu política de reembolso o garantía — revísala con el abogado antes de publicar"),
      faqs: R("preguntas frecuentes como P: … / R: …, separadas por un renglón en blanco (¿necesito saber leer partitura?, ¿sirve para requinto?, ¿cuánto tiempo tengo acceso?, ¿qué docerola necesito?)"),
    },
  },
};

export const MENTORIA = {
  slug: "mentoria-docerola",
  titulo: "Mentoría grupal semanal",
  descripcion: "Sesiones en vivo cada semana: corrección de vicios, rolas que no te salen y revisión de tus arreglos.",
  modulos: [
    { titulo: "Sesiones en vivo", ruta: "bonus", descripcion: "La próxima sesión, con su enlace. Después se le pega la grabación.", lecciones: [] },
    { titulo: "Grabaciones", ruta: "bonus", descripcion: "Todas las sesiones pasadas.", lecciones: [] },
  ],
};

export const MODULOS = [
  // ───────────────────────────── M0 ─────────────────────────────
  {
    titulo: "M0 · Arranque",
    ruta: "principal",
    descripcion: "Tu primera victoria en 20 minutos y cómo sacarle todo al curso.",
    lecciones: [
      nucleo("0.1 Bienvenida: lo que vas a poder tocar", {
        objetivo: "que el alumno vea el resultado final del curso y sepa por qué este método es distinto",
        gancho: "toca 30 s del requinto más impresionante que el alumno va a poder tocar al final",
        minimo: "quién eres, qué te dio la música y la promesa del curso en una frase",
        practica: "recorrido rápido: rasgueo → requinto → arreglo propio (lo que van a construir)",
        criterio: "por qué no vas a depender de tutoriales: vas a entender el porqué de lo que tocas",
        reto: "que escriba en su bitácora qué rola quiere poder tocar al terminar",
        puente: "en 20 minutos ya vas a estar rasgueando tu primer tumbado",
      }, { preview: true }),
      nucleo("0.2 Cómo usar este curso", {
        objetivo: "que sepa usar el ciclo Mínimo → Práctica → Criterio, las rutas y el reproductor",
        gancho: "muestra el reproductor en 0.5x y repitiendo un pedazo: “así vas a practicar”",
        minimo: "las 3 rutas: principal (obligatoria), profunda y evaluaciones (optativas); los Datos Crack",
        practica: "demo del reproductor: velocidad, repetir A-B, modo espejo, capítulos; la bitácora y la racha",
        criterio: "cuánto practicar al día y por qué es mejor poco diario que mucho el domingo",
        reto: "registrar su primera práctica en la bitácora",
        puente: "menciona de pasada que existe la mentoría en vivo; “más adelante te cuento”",
      }),
      quiz(
        "0.3 Diagnóstico: ¿de dónde partes?",
        { instrucciones: "contesta honesto; no hay respuestas malas: esto sólo te dice por dónde empezar" },
        [
          { pregunta: "¿Ya tocas guitarra de 6 cuerdas?", opciones: ["Sí, con soltura", "Un poco", "Nunca"], correcta: 0 },
          { pregunta: "¿Puedes cambiar entre G, C y D sin parar el rasgueo?", opciones: ["Sí", "Todavía no"], correcta: 0 },
          { pregunta: "¿Sabes leer tablatura?", opciones: ["Sí", "No"], correcta: 0 },
          { pregunta: "¿Sabes qué es el grado V de una tonalidad?", opciones: ["Sí", "No"], correcta: 0 },
          { pregunta: "¿Has sacado una rola a oído?", opciones: ["Sí", "No"], correcta: 0 },
        ],
        {
          diagnostico: [
            { min: 0, texto: R("recomendación para quien empieza de cero, p. ej.: sigue el curso en orden, sin saltarte M1 y M2") },
            { min: 40, texto: R("recomendación intermedia, p. ej.: ve rápido por M1–M2 y pon toda tu atención en M3") },
            { min: 80, texto: R("recomendación avanzada, p. ej.: M1–M3 como repaso, el curso de verdad empieza en M4") },
          ],
        },
      ),
      nucleo("0.4 Tu primer rasgueo tumbado con 2 acordes", {
        objetivo: "rasguear un patrón tumbado básico con 2 acordes a tu tempo meta en bpm",
        gancho: "toca el patrón con los 2 acordes sobre una pista y que se escuche ya a corrido",
        minimo: "los 2 acordes (cuáles y por qué esos) y el patrón en palabras: abajo/arriba/apagado",
        practica: "patrón a 60 bpm → cambio de acorde cada 2 compases → sobre la pista de acompañamiento",
        criterio: "por qué empezamos por el rasgueo y no por el requinto",
        reto: "4 vueltas seguidas sin parar sobre la pista",
        puente: "ahora sí: conoce el instrumento que tienes en las manos",
      }, { preview: true }),
      capsula("¿Por qué la docerola suena “a coro”?", {
        dato: "la frase gancho, p. ej.: tu docerola es un coro de 2 guitarras en un solo instrumento",
        explicacion: "cuerdas en octava + pares que nunca quedan 100% afinados = batimiento, un chorus natural",
        aplicacion: "por eso afinar bien los pares cambia todo el sonido (lo vemos en 1.2)",
      }),
    ],
  },

  // ───────────────────────────── M1 ─────────────────────────────
  {
    titulo: "M1 · Conoce tu docerola (lo que nadie te dice)",
    ruta: "principal",
    descripcion: "Lo que se vive en el día a día: afinación, cuerdas, mantenimiento y el capo como arma.",
    lecciones: [
      nucleo("1.1 Anatomía que sí usas", {
        objetivo: "que ubique órdenes, octavas y unísonos, escala, acción y alma en SU docerola",
        minimo: "6 órdenes, cuáles van en octava y cuáles al unísono; qué es la acción y el alma (truss rod)",
        practica: "recorrido físico por el instrumento con cámara cerrada",
        criterio: "qué partes se ajustan en casa y cuáles son de laudero",
        reto: "medir la acción de su docerola en el traste 12 (y anotarla)",
      }),
      nucleo("1.2 Afinar la 12 sin sufrir", {
        objetivo: "afinar los 12 en pocos minutos (di cuántos), con los pares sin batimiento",
        minimo: "orden de afinado, afinar primero las gruesas, luego sus octavas; medio tono abajo sí o no",
        practica: "afinador + oído: cómo escuchar el batimiento entre pares y eliminarlo",
        criterio: "cuándo conviene afinar medio tono abajo (tensión, voz del cantante) y qué cambia",
        reto: "afinar desde cero y grabar un acorde al aire: que no “tiemble”",
      }),
      nucleo("1.3 Cuerdas: calibres, cuándo cambiarlas y cómo encordar", {
        minimo: "calibres que recomiendas para corrido tumbado y por qué; señales de cuerdas muertas",
        practica: "encordar una 12 paso a paso: orden, vueltas en la clavija, estirado",
        criterio: "cada cuánto cambiar según cuánto tocas y si tocas en vivo",
        reto: "calcular cuándo le toca su siguiente cambio y anotarlo",
      }),
      nucleo("1.4 Mantenimiento de supervivencia", {
        minimo: "humedad, calor (el carro), limpieza, estuche, viajes",
        practica: "rutina de limpieza de 5 minutos y cómo guardarla",
        criterio: "señales de alarma que requieren laudero (puente levantado, mástil vencido)",
        reto: "checklist de mantenimiento aplicada a su instrumento",
      }),
      herramienta("1.5 El capotraste como arma (1): tono y timbre", {
        minimo: "el capo cambia el tono sin cambiar las posiciones; también cambia el timbre",
        practica: "mismo rasgueo sin capo, capo 2, capo 4: escucha la diferencia",
        criterio: "cuándo usar capo por la voz del cantante y cuándo por el color",
        reto: "tocar el patrón de 0.4 en 3 posiciones de capo distintas",
      }),
      capsula("La tensión que carga tu mástil", {
        dato: "la tensión total de un juego de 12 cuerdas vs uno de 6 (usa la tabla del fabricante de tus cuerdas)",
        explicacion: "por qué el alma y el puente trabajan el doble, y por qué muchos afinan medio tono abajo",
        aplicacion: "no dejes tu docerola afinada meses sin tocar si notas que el puente se levanta",
      }),
      capsula("Cedro vs abeto: ¿de verdad se oye?", {
        dato: "la madera de la tapa cambia el sonido más que la de los aros y el fondo",
        explicacion: "tapa sólida vs laminada; cedro (cálido, abre rápido) vs abeto (brillante, más headroom)",
        aplicacion: "qué buscar si vas a comprar tu siguiente docerola",
      }),
      capsula("Historia express de la docerola en el regional", {
        dato: "cómo y cuándo entró la 12 cuerdas al regional mexicano",
        explicacion: "de dónde viene, quién la popularizó en el corrido, cómo llegó al tumbado",
        aplicacion: "por qué hoy es la base armónica del género",
      }),
      profunda("1.6 Guía de compra y calidades", {
        objetivo: "que sepa elegir una docerola por su presupuesto y revisar una usada",
        minimo: "laminada vs sólida, gamas de precio, marcas que recomiendas y por qué",
        practica: "checklist en vivo revisando una docerola: mástil, trastes, puente, electrónica",
        criterio: "en qué vale la pena gastar y en qué no",
      }),
      filosofia("Tu instrumento es tu socio", {
        idea: "cuidar la herramienta es respeto por el oficio",
        historia: "una historia tuya con un instrumento (el primero, uno que se te echó a perder, uno que te salvó un toque)",
        pregunta: "¿qué le debes hoy a tu instrumento?",
      }),
    ],
  },

  // ───────────────────────────── M2 ─────────────────────────────
  {
    titulo: "M2 · Tus dos manos",
    ruta: "principal",
    descripcion: "Postura, púa, presión mínima y cómo cazar tus propios vicios.",
    lecciones: [
      nucleo("2.1 Postura y agarre", {
        minimo: "sentado, parado, con correa; hombros y muñecas sin tensión",
        practica: "ajustar la postura con el celular grabando de frente y de lado",
        criterio: "la postura que ves en videos de conciertos vs la que te deja tocar 3 horas",
        reto: "foto o video de su postura comparado con el tuyo",
      }),
      nucleo("2.2 Mano derecha: el motor del corrido", {
        minimo: "tipo y grosor de púa, ángulo, muñeca vs antebrazo, el apagado",
        practica: "rasgueo sólo en cuerdas graves / sólo agudas / completo; apagado con la palma",
        criterio: "cuánta cuerda atacar según la sección de la rola",
        reto: "1 minuto de rasgueo a 70 bpm sin que se escuche el choque de la púa",
      }),
      nucleo("2.3 Mano izquierda: presión mínima en 12 cuerdas", {
        minimo: "pulgar, arco de dedos y la presión justa (la 12 castiga el exceso)",
        practica: "ejercicio de presión mínima: aflojar hasta que zumbe y volver a apretar",
        criterio: "cómo hacer cejillas en la 12 sin dolor",
        reto: "acorde con cejilla que suene limpio 10 veces seguidas",
      }),
      nucleo("2.4 Calentamiento de 5 minutos", {
        minimo: "por qué calentar evita lesiones y acelera el aprendizaje",
        practica: "rutina de 5 minutos: estiramiento + cromático 1-2-3-4 + rasgueo lento",
        reto: "hacer la rutina 5 días seguidos (se ve en la racha)",
      }),
      nucleo("2.5 Vicios comunes y autodiagnóstico", {
        minimo: "los 5 vicios que más ves en alumnos",
        practica: "cómo grabarse con el celular y revisarse con la checklist",
        criterio: "qué vicios se corrigen solos y cuáles se vuelven lesión",
        reto: "grabarse 1 minuto y marcar la checklist",
      }, { cta: "revision", ctaTexto: "la cámara no miente, pero tampoco te corrige: ofrece la revisión/mentoría" }),
      capsula("¿Por qué duelen más los dedos en una 12?", {
        dato: "presionas el doble de cuerdas con la misma yema",
        explicacion: "más cuerdas = más fuerza para la misma nota; el callo es una adaptación",
        aplicacion: "presión mínima + sesiones cortas = callo sin lesión",
      }),
      filosofia("Disciplina vs motivación", {
        idea: "la motivación te arranca, el hábito te sostiene",
        historia: "una época en la que practicaste sin ganas y qué te dejó",
        pregunta: "¿a qué hora de tu día va a vivir tu práctica?",
      }),
    ],
  },

  // ───────────────────────────── M3 ─────────────────────────────
  {
    titulo: "M3 · Ritmo y rasgueo tumbado",
    ruta: "principal",
    descripcion: "El groove del tumbado, los acordes del 80% y tu primera rola completa.",
    lecciones: [
      nucleo("3.1 Lo mínimo de ritmo", {
        minimo: "pulso, compás y subdivisión: el tumbado vive en la subdivisión",
        practica: "contar en voz alta mientras rasgueas; palmadas sobre la pista",
        criterio: "cómo se siente adelantado vs relajado (“tumbado”) el mismo patrón",
        reto: "rasgueo con metrónomo en 2 y 4",
      }),
      nucleo("3.2 Los acordes del 80%", {
        minimo: "mayores, menores y séptimas en las posiciones que se usan en el corrido",
        practica: "digitación de cada acorde y cómo suena en la 12",
        criterio: "cuáles son las tonalidades más comunes del género y por qué",
        reto: "tocar la lista de acordes en ciclo a 60 bpm",
      }),
      nucleo("3.3 Patrón base del tumbado + variantes", {
        minimo: "el patrón base escrito como ↓ ↓↑ x ↑… (x = apagado)",
        practica: "patrón base 60 → 90 bpm; variante 1 y 2; dónde cae el apagado",
        criterio: "qué variante va en la estrofa y cuál en el coro",
        reto: "patrón base a tu tempo meta limpio durante 2 minutos",
      }),
      nucleo("3.4 Cambios de acorde limpios", {
        minimo: "el dedo ancla y el cambio anticipado",
        practica: "cambios en ciclos de 1 minuto: contar cuántos logras",
        criterio: "por qué un cambio a tiempo vale más que un acorde perfecto tarde",
        reto: "60 cambios por minuto entre los 2 acordes más difíciles",
      }),
      nucleo("3.5 Rola ancla 1 completa", {
        objetivo: "tocar completa la rola ancla 1 con la pista de acompañamiento",
        gancho: "toca la rola completa",
        minimo: "la estructura de la rola: intro, estrofa, coro; los acordes",
        practica: "sección por sección, después con la pista a 60%, 80% y 100%",
        criterio: "qué hace que tu versión suene a disco y no a ensayo",
        reto: "grabarse tocando la rola completa sobre la pista",
      }),
      nucleo("3.6 Leer tablatura en 5 minutos", {
        minimo: "líneas = órdenes, números = trastes, cómo se escribe el ritmo en tab",
        practica: "leer la intro de la rola ancla con la tablatura interactiva",
        criterio: "cuándo basta la tab y cuándo conviene la partitura (Ruta Profunda)",
        reto: "leer y tocar una frase de 2 compases que nunca ha escuchado",
      }),
      capsula("El metrónomo y la mielina", {
        dato: "practicar lento no es perder el tiempo: es cómo el cerebro graba el movimiento",
        explicacion: "la repetición precisa refuerza el camino neuronal; repetir con errores graba el error",
        aplicacion: "baja el tempo hasta que salga perfecto y sube de 5 en 5",
      }),
      profunda("3.7 Lectura rítmica en partitura", {
        minimo: "figuras, silencios, puntillo y síncopa",
        practica: "leer el patrón del tumbado en partitura",
      }),
      filosofia("El groove es primero", {
        idea: "tocar a tiempo es tocar bonito",
        historia: "un músico que admiras por su groove más que por su técnica",
        pregunta: "¿tu público baila o sólo escucha?",
      }),
    ],
  },

  // ───────────────────────────── M4 ─────────────────────────────
  {
    titulo: "M4 · El mapa: notas, intervalos y grados",
    ruta: "principal",
    descripcion: "Entender lo que tocas para no volver a depender de un tutorial.",
    lecciones: [
      nucleo("4.1 Las notas en el diapasón", {
        minimo: "notas naturales, sostenidos/bemoles y los atajos de octava",
        practica: "encontrar la misma nota en 3 lugares; juego de velocidad",
        reto: "nombrar todas las notas de la 6a y 5a cuerda en menos de 1 minuto",
      }),
      nucleo("4.2 Intervalos que suenan a corrido", {
        minimo: "3ras y 6tas: el sonido de las segundas voces y del requinto",
        practica: "tocar 3ras y 6tas sobre una escala mayor",
        criterio: "por qué el corrido ama las 3ras y 6tas paralelas",
      }),
      nucleo("4.3 Grados: por qué los corridos se “parecen”", {
        minimo: "I, IV, V, el V7 y el relativo menor",
        practica: "la misma progresión en números tocada en 2 tonos",
        criterio: "pensar en grados = poder tocar cualquier rola en cualquier tono",
      }),
      herramienta("4.4 Progresiones típicas y transponer con capo", {
        minimo: "las progresiones más comunes del tumbado en grados",
        practica: "subir la progresión con capo para la voz de un cantante",
        criterio: "cuándo transportar con capo y cuándo cambiar de posición",
      }),
      nucleo("4.5 Rola ancla 2 en 3 tonos", {
        objetivo: "tocar la rola ancla 2 en su tono original y en 2 tonos más",
        practica: "de acordes a grados y de grados al tono nuevo",
        reto: "grabarla en el tono de su voz (o de un cantante que conozca)",
      }),
      capsula("¿Por qué La = 440?", {
        dato: "la nota La que usa tu afinador vibra 440 veces por segundo",
        explicacion: "de dónde sale ese estándar y por qué no siempre fue así",
        aplicacion: "por qué tu docerola afinada a 440 empata con cualquier pista",
      }),
      profunda("4.6 Partitura desde cero", {
        minimo: "pentagrama, clave de sol, figuras y dónde está cada nota en el diapasón",
        practica: "leer una melodía sencilla del género en partitura",
      }),
      profunda("4.7 Intervalos completos y armonía funcional", {
        minimo: "todos los intervalos, tónica/subdominante/dominante",
        practica: "analizar una rola completa por funciones",
      }),
      quiz(
        "Quiz del mapa",
        { instrucciones: "comprueba que ya entiendes el mapa antes de meterte a las escalas" },
        [
          { pregunta: "En tono de G, ¿cuáles son los grados I, IV y V?", opciones: ["G, C, D", "G, A, B", "G, D, E"], correcta: 0, explicacion: "G (I), C (IV), D (V)." },
          { pregunta: "¿Cuál es el relativo menor de C?", opciones: ["Em", "Am", "Dm"], correcta: 1, explicacion: "Comparten las mismas notas: Am es el VI de C." },
          { pregunta: "¿Qué intervalo hay de C a E?", opciones: ["Tercera mayor", "Quinta justa", "Segunda mayor"], correcta: 0 },
          { pregunta: "¿En qué traste está la octava de una cuerda al aire?", opciones: ["7", "12", "5"], correcta: 1 },
          { pregunta: "Si pones el capo en el traste 2 y tocas la forma de G, ¿qué acorde suena?", opciones: ["G", "A", "F"], correcta: 1, explicacion: "Cada traste sube medio tono: G + 2 semitonos = A." },
        ],
      ),
      filosofia("Entender vs memorizar", {
        idea: "el que memoriza depende del tutorial; el que entiende saca cualquier rola",
        historia: "la primera vez que entendiste algo que antes sólo repetías",
        pregunta: "¿qué rola te sabes “de memoria” pero no entiendes?",
      }),
    ],
  },

  // ───────────────────────────── M5 ─────────────────────────────
  {
    titulo: "M5 · Escalas como recurso",
    ruta: "principal",
    descripcion: "Digitación y escalas para frasear, no para hacer ejercicios. Termina con tu primer requinto.",
    lecciones: [
      nucleo("5.1 Pentatónica: frases, no cajas", {
        minimo: "la pentatónica menor y mayor; por qué no se piensa en 5 cajas sueltas",
        practica: "frases típicas del género dentro de la pentatónica",
        criterio: "en qué momentos de la rola suena bien y en cuáles se oye a rock",
      }),
      nucleo("5.2 Mayor y menor natural", {
        minimo: "las dos escalas y su relación (relativos)",
        practica: "recorridos en 2 posiciones útiles para el requinto",
      }),
      nucleo("5.3 Menor armónica: el sabor tumbado", {
        minimo: "la 7a elevada y por qué hace que el V suene a dominante en tono menor",
        practica: "frases con la menor armónica sobre i–V7",
        criterio: "cuándo suena a tumbado y cuándo a otro género (flamenco, clásico)",
      }),
      nucleo("5.4 Cromatismos y notas de paso", {
        minimo: "notas de paso cromáticas: “el caminado”",
        practica: "conectar dos notas de la escala con un cromatismo a tiempo",
        criterio: "la nota cromática va en tiempo débil; el error común es caer en ella",
      }),
      nucleo("5.5 3ras y 6tas paralelas", {
        minimo: "armonizar una melodía en 3ras y 6tas dentro de la escala",
        practica: "la misma frase sola, en 3ras y en 6tas",
        criterio: "el sonido de “dos guitarras” del corrido clásico al tumbado",
      }),
      nucleo("5.6 Rutinas de digitación con metrónomo", {
        minimo: "púa alterna vs economía; subir el tempo de 5 en 5",
        practica: "rutina diaria de 10 minutos con metrónomo",
        reto: "registrar en la bitácora su tempo máximo limpio",
      }),
      nucleo("5.7 Tu primer requinto: intro de la rola ancla 3", {
        objetivo: "tocar la intro de requinto de la rola ancla 3 a tempo",
        gancho: "toca la intro completa a tempo con la pista",
        minimo: "de qué escala salen las notas y qué técnica pide",
        practica: "frase por frase con la tablatura interactiva: 50% → 75% → 100%",
        criterio: "qué la hace sonar a tumbado: ataque, apagados, dinámica",
        reto: "grabarse tocando la intro sobre la pista",
        puente: "estás a la mitad: toca demostrar lo aprendido (y tu primera revisión va por nuestra cuenta)",
      }),
      capsula("Por qué la pentatónica “no falla”", {
        dato: "la pentatónica no tiene semitonos: casi no hay notas que choquen",
        explicacion: "sin semitonos no hay tensión fuerte entre notas vecinas",
        aplicacion: "empieza a improvisar con ella; las notas “sabrosas” vienen después",
      }),
      profunda("5.8 Modos y menor melódica", {
        minimo: "los modos más útiles para el género y la menor melódica",
        practica: "una frase en cada modo sobre el mismo acorde",
      }),
      filosofia("La escala es un mapa, no el viaje", {
        idea: "saber escalas no es saber frasear",
        historia: "un músico que toca pocas notas y dice mucho",
        pregunta: "¿qué quieres decir con tu requinto?",
      }),
    ],
  },

  // ─────────────────────────── HITO ────────────────────────────
  {
    titulo: "Hito de mitad: Evaluación 1-A",
    ruta: "evaluacion",
    descripcion: "Demuestra lo aprendido con una canción intermedia. Tu primera revisión personal va incluida.",
    lecciones: [
      {
        titulo: "Evaluación 1-A: tablatura interactiva",
        tipo: "tab",
        etiqueta: "evaluacion",
        opcional: true,
        contenido: {
          instrucciones: R("cómo estudiar la canción intermedia con la tablatura: tempo, repetición de compases, pistas"),
        },
      },
      evaluacion(
        "Evaluación 1-A: canción intermedia",
        {
          instrucciones: "qué canción es, qué partes tocar y a qué tempo; primero autoevalúate con la rúbrica",
          entregables: "video tocando la canción sobre la pista sin guitarra (se ven las dos manos)",
        },
        { rubrica: RUBRICA_E1, cta: "revision", ctaTexto: "tu primera revisión personal va incluida: aprovéchala" },
      ),
    ],
  },

  // ───────────────────────────── M6 ─────────────────────────────
  {
    titulo: "M6 · Oído de ladrón: escucha activa",
    ruta: "principal",
    descripcion: "Saca cualquier rola con tu oído, el 0.5x y la IA. Roba ideas con criterio.",
    lecciones: [
      nucleo("6.1 Las capas de una rola", {
        minimo: "quién hace qué: requinto, docerola, tololoche, voz, percusión",
        practica: "escuchar la misma rola 4 veces, cada vez siguiendo un instrumento",
        reto: "describir qué hace la docerola en el coro de una rola que le guste",
      }),
      herramienta("6.2 Aísla el requinto o la docerola con IA", {
        minimo: "qué hacen Moises y LALAL.ai y qué no pueden hacer",
        practica: "flujo paso a paso: subir la rola, separar, bajar la pista de guitarra",
        criterio: "calidad de la separación y cuándo confiar en ella",
        reto: "aislar la guitarra de una rola que quiera sacar",
      }),
      herramienta("6.3 Saca frases a oído en 0.5x", {
        minimo: "ralentizar sin cambiar el tono; frases cortas, una nota a la vez",
        practica: "sacar una frase de 2 compases en vivo, pensando en voz alta",
        criterio: "cuándo usar 0.5x y cuándo 0.75x",
      }),
      herramienta("6.4 Tono y capo de cualquier rola en 2 minutos", {
        minimo: "encontrar la tónica con el bajo y la última nota; deducir el capo",
        practica: "3 rolas distintas, cronometrado",
      }),
      nucleo("6.5 Transcribe tu primera frase", {
        minimo: "escribir en tab: TuxGuitar (gratis), Guitar Pro o papel",
        practica: "transcribir la frase de 6.3 y comprobarla con la tablatura interactiva",
        reto: "transcribir 1 frase nueva y subirla a su banco de licks",
      }),
      nucleo("6.6 Tu banco de licks", {
        minimo: "cómo archivar lo que robas: rola, compás, tono, técnica",
        practica: "llenar la plantilla del banco de licks con 3 frases",
        criterio: "un lick sin contexto no sirve: anota en qué acorde vive",
      }),
      capsula("Cómo separa pistas una IA", {
        dato: "la IA “aprendió” cómo suena una guitarra escuchando miles de canciones",
        explicacion: "redes neuronales entrenadas con pistas separadas; por qué a veces deja residuos",
        aplicacion: "si la separación suena rara, compara con la mezcla original",
      }),
      capsula("Ralentizar sin cambiar el tono", {
        dato: "tu reproductor puede ir a la mitad sin que suene grave",
        explicacion: "time-stretching: estirar el tiempo sin tocar la frecuencia",
        aplicacion: "usa 0.5x para aprender y 1x para comprobar",
      }),
      filosofia("Roba como artista", {
        idea: "copiar → entender → transformar; la diferencia entre inspirarse y plagiar",
        historia: "una idea que robaste y convertiste en tuya",
        pregunta: "¿de quién vas a robar esta semana y qué vas a transformar?",
      }, { cta: "mentoria", ctaTexto: "la rola que no te sale: tráela a la sesión en vivo" }),
    ],
  },

  // ───────────────────────────── M7 ─────────────────────────────
  {
    titulo: "M7 · Armonía con criterio",
    ruta: "principal",
    descripcion: "Voicings, bajos, dominantes secundarias y rearmonizar sin arruinar la rola.",
    lecciones: [
      nucleo("7.1 Voicings de docerola", {
        minimo: "el mismo acorde en 3 posiciones: registro y octavas en la 12",
        practica: "qué voicing usar en estrofa vs coro",
      }),
      nucleo("7.2 Inversiones y bajos: el diálogo con el tololoche", {
        minimo: "inversiones y bajos de paso",
        practica: "caminar el bajo entre acordes sin pisar al tololoche",
        criterio: "cuándo la docerola deja el bajo libre",
      }),
      nucleo("7.3 Dominantes secundarias y acordes de paso", {
        minimo: "el V del V y los acordes de paso típicos del género",
        practica: "meter una dominante secundaria en una progresión conocida",
      }),
      nucleo("7.4 Armonizar una melodía", {
        minimo: "de la nota de la melodía al acorde que la sostiene",
        practica: "armonizar la melodía de un coro conocido",
      }),
      nucleo("7.5 Rearmonizar con gusto", {
        minimo: "sustituir sin cambiar la función",
        practica: "3 rearmonizaciones de la misma progresión",
        criterio: "cuándo la rearmonización suma y cuándo le estorba a la voz",
      }),
      nucleo("7.6 Rola ancla 4 con arreglo armónico propio", {
        objetivo: "tocar la rola ancla 4 con al menos 2 decisiones armónicas propias",
        reto: "grabarla y explicar en la bitácora qué cambió y por qué",
      }),
      capsula("Por qué el acorde mayor “suena feliz”", {
        dato: "el acorde mayor ya vive escondido dentro de una sola nota",
        explicacion: "la serie de armónicos: una cuerda vibra en varias frecuencias a la vez",
        aplicacion: "por eso los acordes mayores al aire suenan tan llenos en la 12",
      }),
      profunda("7.7 Sustituciones", {
        minimo: "sustitución tritonal, intercambio modal",
        practica: "aplicarlas a una rola del género con medida",
      }),
      filosofia("Toca para la rola, no para lucirte", {
        idea: "menos es más: el acompañante sirve a la canción",
        historia: "una vez que te pasaste de notas (o viste a alguien hacerlo)",
        pregunta: "¿qué le quitarías a tu arreglo para que la voz brille más?",
      }),
    ],
  },

  // ───────────────────────────── M8 ─────────────────────────────
  {
    titulo: "M8 · Técnicas de los grandes",
    ruta: "principal",
    descripcion: "Ligados, bends, trémolo, armónicos, pinch harmonic y sweep: recursos, no trucos.",
    lecciones: [
      nucleo("8.1 Ligados y arrastres", { minimo: "hammer-on, pull-off y slide", practica: "frases típicas del requinto con ligados" }),
      nucleo("8.2 Bends y vibrato", { minimo: "cuánto subir y cómo afinar el bend", practica: "bends a 1/2 y 1 tono comparando con la nota real" }),
      nucleo("8.3 Trémolo y picado rápido", { minimo: "trémolo con la muñeca relajada", practica: "subir el tempo del picado de 5 en 5" }),
      nucleo("8.4 Armónicos naturales, artificiales y pinch harmonic", {
        minimo: "dónde están los armónicos y cómo sacar el pinch con la púa y el pulgar",
        practica: "armónicos en 12, 7 y 5; pinch en una frase",
        criterio: "cuándo un armónico adorna y cuándo distrae",
      }),
      nucleo("8.5 Sweep picking aplicado al corrido", {
        minimo: "barrido de 3 cuerdas y cómo apagar las que no suenan",
        practica: "arpegio barrido sobre un acorde del género",
        criterio: "el sweep en el tumbado: dónde lo has escuchado y cuánto usarlo",
      }),
      nucleo("8.6 Robar técnicas de otros géneros", {
        minimo: "rock, jazz, flamenco: qué se adapta bien al corrido",
        practica: "una frase de otro género llevada al tumbado",
      }),
      capsula("Nodos: por qué los trastes 12, 7 y 5", {
        dato: "tocar el armónico del traste 12 divide la cuerda exactamente a la mitad",
        explicacion: "nodos en 1/2, 1/3 y 1/4 de la cuerda = trastes 12, 7 y 5",
        aplicacion: "busca armónicos donde la cuerda se divide en partes iguales",
      }),
      capsula("La física del pinch harmonic", {
        dato: "el “chillido” sale de apagar la nota justo en un nodo",
        explicacion: "el pulgar toca la cuerda al mismo tiempo que la púa y deja sonar sólo un armónico",
        aplicacion: "mueve el punto de ataque para encontrar distintos armónicos",
      }),
      {
        titulo: "Evaluación 1-B: tablatura interactiva",
        tipo: "tab",
        etiqueta: "evaluacion",
        opcional: true,
        contenido: { instrucciones: R("cómo estudiar la canción avanzada con la tablatura") },
      },
      evaluacion(
        "Evaluación 1-B: canción avanzada",
        {
          instrucciones: "qué canción es, qué partes tocar y a qué tempo; primero autoevalúate con la rúbrica",
          entregables: "video tocando la canción sobre la pista sin guitarra",
        },
        { rubrica: RUBRICA_E1 },
      ),
      filosofia("El truco no es la canción", {
        idea: "la técnica al servicio de la música",
        historia: "un solo que te impresionó por lo que dijo, no por lo rápido",
        pregunta: "¿qué técnica estás usando para esconderte?",
      }),
    ],
  },

  // ───────────────────────────── M9 ─────────────────────────────
  {
    titulo: "M9 · Adornos e improvisación con criterio",
    ruta: "principal",
    descripcion: "Rellenos, pregunta y respuesta con la voz, notas objetivo y tu requinto de intro.",
    lecciones: [
      nucleo("9.1 El vocabulario del relleno", { minimo: "los rellenos típicos entre frases de la voz", practica: "5 rellenos para el mismo hueco" }),
      nucleo("9.2 Pregunta y respuesta con la voz", {
        minimo: "dejar espacio: el requinto contesta, no interrumpe",
        practica: "rellenar sólo en los huecos de una pista con voz",
      }),
      nucleo("9.3 Notas objetivo sobre una progresión", {
        minimo: "caer en notas del acorde en el tiempo fuerte",
        practica: "improvisar apuntando a la 3a de cada acorde",
      }),
      nucleo("9.4 Un requinto de intro con motivos", {
        minimo: "motivo, repetición y variación",
        practica: "construir una intro de 8 compases a partir de un motivo de 3 notas",
      }),
      nucleo("9.5 Tres versiones del mismo relleno", {
        minimo: "decidir es parte de tocar",
        practica: "grabar 3 versiones y elegir una",
        reto: "explicar en la bitácora por qué eligió esa versión",
      }),
      capsula("Tu cerebro en flow", {
        dato: "al improvisar bien, una parte del cerebro que te juzga baja su actividad",
        explicacion: "qué pasa en el cerebro de un músico improvisando (estudios con resonancia)",
        aplicacion: "practica tanto que puedas dejar de pensar al tocar",
      }),
      filosofia("El error como información", {
        idea: "el error no es fracaso, es el dato que te dice qué practicar",
        historia: "un error en vivo que te enseñó algo",
        pregunta: "¿qué error repites y qué te está diciendo?",
      }),
    ],
  },

  // ───────────────────────────── M10 ────────────────────────────
  {
    titulo: "M10 · Crea: melodías y rasgueo para temas inéditos",
    ruta: "principal",
    descripcion: "De la letra al arreglo: rasgueo, progresión, requinto propio y maqueta.",
    lecciones: [
      nucleo("10.1 De la letra al rasgueo", { minimo: "elegir el rasgueo por la métrica y el tempo de la letra", practica: "3 letras distintas, 3 rasgueos distintos" }),
      nucleo("10.2 La progresión de un tema nuevo", { minimo: "crear la progresión desde la melodía o desde el feeling", practica: "armar la progresión de un tema propio" }),
      nucleo("10.3 Componer el requinto: intro, rellenos y puente", {
        minimo: "el requinto como segunda voz de la canción",
        practica: "escribir la intro y 2 rellenos de un tema propio",
      }),
      herramienta("10.4 IA como coautor, no como autor", {
        minimo: "qué sí le pides a la IA (ideas, pistas de práctica, maquetas) y qué no",
        practica: "flujo real: de una idea tuya a una maqueta con apoyo de IA",
        criterio: "límites éticos y derechos sobre lo que genera una IA",
      }),
      nucleo("10.5 Maqueta en casa", {
        minimo: "celular vs interfaz: lo mínimo para que se escuche decente",
        practica: "grabar docerola + requinto en capas",
      }),
      nucleo("10.6 Tu siguiente nivel: grabar en estudio", {
        minimo: "qué cambia de una maqueta a una producción",
        practica: "recorrido por una sesión real en el estudio",
      }, { cta: "estudio", ctaTexto: "graba tu arreglo en ARIDO con precio de alumno" }),
      capsula("Registra tu obra en 60 segundos", {
        dato: "tu canción es tuya desde que la creas, pero registrarla te protege",
        explicacion: "qué es el registro de obra (INDAUTOR en México) y para qué sirve; aclarar que no es asesoría legal",
        aplicacion: "registra tus temas antes de subirlos",
      }),
      filosofia("El músico completo", {
        idea: "oficio, negocio y disciplina: tocar bien es sólo una parte",
        historia: "lo que aprendiste del negocio de la música que nadie te enseñó",
        pregunta: "¿qué músico quieres ser en 5 años?",
      }),
    ],
  },

  // ─────────────────────────── GRADUACIÓN ───────────────────────
  {
    titulo: "Graduación",
    ruta: "principal",
    descripcion: "Tu arreglo de requinto, tu plan de 90 días y tu certificado.",
    lecciones: [
      evaluacion(
        "Evaluación 2: tu arreglo de requinto",
        {
          instrucciones: "elegir la rola, crear el arreglo de requinto (intro, rellenos, final) y autoevaluarse",
          entregables: "video tocándolo + tablatura (TuxGuitar/Guitar Pro/foto) + texto: “por qué elegí esto”",
        },
        { rubrica: RUBRICA_E2 },
      ),
      nucleo("G.1 Tu plan de 90 días", {
        minimo: "cómo mantener y seguir subiendo el nivel sin el curso",
        practica: "armar la rutina semanal con la plantilla de 90 días",
      }),
      nucleo("G.2 Tu certificado y lo que sigue", {
        minimo: "los 2 certificados: de término y con mención",
        practica: "cómo descargarlo y compartirlo",
      }, { cta: "mentoria", ctaTexto: "mentoría grupal semanal con precio fundador para graduados" }),
      filosofia("Carta final", {
        idea: "el mensaje que quieres que se lleven para toda la vida",
        historia: "por qué hiciste este curso",
        pregunta: "¿qué vas a tocar mañana?",
      }),
    ],
  },
];
