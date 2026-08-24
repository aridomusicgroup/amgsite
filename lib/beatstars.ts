// Utility functions for BeatStars data mapping

export function formatKey(key: string): string {
  if (!key || key === "NONE") return "—";
  const map: Record<string, string> = {
    C_MAJOR: "C", C_MINOR: "Cm",
    C_SHARP_MAJOR: "C#", C_SHARP_MINOR: "C#m",
    D_FLAT_MAJOR: "Db", D_FLAT_MINOR: "Dbm",
    D_MAJOR: "D", D_MINOR: "Dm",
    D_SHARP_MAJOR: "D#", D_SHARP_MINOR: "D#m",
    E_FLAT_MAJOR: "Eb", E_FLAT_MINOR: "Ebm",
    E_MAJOR: "E", E_MINOR: "Em",
    F_MAJOR: "F", F_MINOR: "Fm",
    F_SHARP_MAJOR: "F#", F_SHARP_MINOR: "F#m",
    G_FLAT_MAJOR: "Gb", G_FLAT_MINOR: "Gbm",
    G_MAJOR: "G", G_MINOR: "Gm",
    G_SHARP_MAJOR: "G#", G_SHARP_MINOR: "G#m",
    A_FLAT_MAJOR: "Ab", A_FLAT_MINOR: "Abm",
    A_MAJOR: "A", A_MINOR: "Am",
    A_SHARP_MAJOR: "A#", A_SHARP_MINOR: "A#m",
    B_FLAT_MAJOR: "Bb", B_FLAT_MINOR: "Bbm",
    B_MAJOR: "B", B_MINOR: "Bm",
  };
  return map[key] ?? key.replace(/_/g, " ").replace(" MAJOR", "").replace(" MINOR", "m");
}

export function formatGenre(genre: string): string {
  const map: Record<string, string> = {
    LATIN: "Latin",
    MEXICAN_POP: "Mexican Pop",
    LATIN_POP: "Latin Pop",
    AFROBEAT: "Afrobeat",
    CORRIDO_TUMBADO: "Corrido Tumbado",
    TRAP: "Trap Latino",
    TRAP_LATINO: "Trap Latino",
    REGGAETON: "Reggaeton",
    HIP_HOP: "Hip Hop",
    R_AND_B: "R&B",
    POP: "Pop",
    CORRIDO: "Corrido",
    BANDA: "Banda",
    NORTEÑO: "Norteño",
    ELECTRO: "Electro",
    DRILL: "Drill",
  };
  return map[genre] ?? genre.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export function cleanTitle(title: string): string {
  // Remove all double quotes (straight and typographic) — los títulos las usan de adorno
  return title.replace(/["“”„]/g, "").replace(/\s+/g, " ").trim();
}

export function primaryGenre(genres: string[]): string {
  if (!genres || genres.length === 0) return "Latin";
  return formatGenre(genres[0]);
}

// Artistas detectables en los títulos de los type beats (con alias/typos comunes)
const ARTIST_PATTERNS: Array<[string, string[]]> = [
  ["Junior H", ["JUNIOR H"]],
  ["Peso Pluma", ["PESO PLUMA"]],
  ["Natanael Cano", ["NATANAEL CANO", "NATANEL CANO"]],
  ["Fuerza Regida", ["FUERZA REGIDA"]],
  ["Netón Vega", ["NETON VEGA"]],
  ["Oscar Maydon", ["OSCAR MAYDON"]],
  ["Gabito Ballesteros", ["GABITO BALLESTEROS"]],
  ["Ivan Cornejo", ["IVAN CORNEJO"]],
  ["Luis R Conriquez", ["LUIS R CONRIQUEZ", "LUIS R. CONRIQUEZ"]],
  ["Calle 24", ["CALLE 24"]],
  ["Tito Double P", ["TITO DOBLE P", "TITO DOUBLE P"]],
  ["Xavi", ["XAVI"]],
  ["Danny Lux", ["DANNY LUX"]],
  ["Eslabón Armado", ["ESLABON ARMADO"]],
  ["Herencia de Patrones", ["HERENCIA DE PATRONES"]],
  ["Dan Sánchez", ["DAN SANCHEZ", "DAN SHANCHEZ"]],
  ["Adrian L Santos", ["ADRIAN L SANTOS"]],
  ["Jaziel Nuñez", ["JAZIEL NUNEZ", "JAZIEL NUNES", "JAZIEL NUÑEZ", "JAZIEL NUÑES"]],
  ["Victor Mendivil", ["VICTOR MENDIVIL"]],
  ["Esaú Ortiz", ["ESAU ORTIZ"]],
  ["Luis Miguel", ["LUIS MIGUEL"]],
  ["Chuyin", ["CHUYIN"]],
  ["Yng Naz", ["YNG NAZ"]],
  ["Tainy", ["TAINY"]],
  ["Jhayco", ["JHAYCO"]],
  ["Myke Towers", ["MYKE TOWERS"]],
  ["Ovi", ["OVI"]],
];

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Detecta los artistas mencionados en el título de un type beat */
export function detectArtists(title: string): string[] {
  const t = stripAccents(title);
  const found: string[] = [];
  for (const [artist, aliases] of ARTIST_PATTERNS) {
    if (aliases.some((a) => t.includes(stripAccents(a)))) found.push(artist);
  }
  return found;
}
