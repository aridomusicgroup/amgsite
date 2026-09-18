/**
 * Sólo para el banco de pruebas (/dev/curso): una frase corta de requinto en
 * MusicXML con su tablatura, para probar la tablatura que suena sin Drive.
 */
const nota = (paso: string, octava: number, cuerda: number, traste: number, alter = 0) => `
      <note>
        <pitch><step>${paso}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octava}</octave></pitch>
        <duration>1</duration><voice>1</voice><type>eighth</type>
        <notations><technical><string>${cuerda}</string><fret>${traste}</fret></technical></notations>
      </note>`;

const compas = (n: number, notas: string, atributos = "") => `
    <measure number="${n}">${atributos}${notas}
    </measure>`;

const ATRIBUTOS = `
      <attributes>
        <divisions>2</divisions>
        <key><fifths>1</fifths><mode>minor</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>
        <staff-details>
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
        </staff-details>
      </attributes>
      <direction placement="above"><sound tempo="90"/></direction>`;

export const MUSICXML_MUESTRA = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Frase de muestra (banco de pruebas)</work-title></work>
  <part-list><score-part id="P1"><part-name>Requinto</part-name></score-part></part-list>
  <part id="P1">${compas(1, nota("E", 4, 1, 0) + nota("G", 4, 1, 3) + nota("A", 4, 1, 5) + nota("B", 4, 1, 7) + nota("A", 4, 1, 5) + nota("G", 4, 1, 3) + nota("E", 4, 1, 0) + nota("D", 4, 2, 3), ATRIBUTOS)}${compas(2, nota("B", 3, 2, 0) + nota("D", 4, 2, 3) + nota("E", 4, 1, 0) + nota("F", 4, 1, 2, 1) + nota("G", 4, 1, 3) + nota("F", 4, 1, 2, 1) + nota("E", 4, 1, 0) + nota("B", 3, 2, 0))}
  </part>
</score-partwise>`;

/**
 * Video local para probar el reproductor (la CSP sólo deja reproducir video del
 * propio sitio). Se genera con:
 *   ffmpeg -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=220 -t 12 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest public/dev/muestra.mp4
 */
export const VIDEO_MUESTRA = "/dev/muestra.mp4";
