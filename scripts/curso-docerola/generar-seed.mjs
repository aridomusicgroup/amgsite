// Genera site/supabase-curso-docerola-seed.sql a partir de temario.mjs.
// Uso: node scripts/curso-docerola/generar-seed.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CURSO, MENTORIA, MODULOS } from "./temario.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, "../../supabase-curso-docerola-seed.sql");

const txt = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const json = (o) => `${txt(JSON.stringify(o ?? {}))}::jsonb`;
const bool = (b) => (b ? "true" : "false");

const lineas = [];
const w = (s = "") => lineas.push(s);

let totalLecciones = 0;
const bloqueModulos = (varCurso, modulos) => {
  modulos.forEach((m, i) => {
    w(`  insert into public.curso_modulos (curso_id, titulo, orden, ruta, descripcion)`);
    w(`    values (${varCurso}, ${txt(m.titulo)}, ${i}, ${txt(m.ruta)}, ${txt(m.descripcion)}) returning id into v_mod;`);
    if (!m.lecciones.length) return;
    w(`  insert into public.curso_lecciones`);
    w(`    (modulo_id, titulo, tipo, etiqueta, opcional, preview, cta, contenido, orden, publicada, estado_produccion) values`);
    m.lecciones.forEach((l, j) => {
      totalLecciones++;
      const coma = j === m.lecciones.length - 1 ? ";" : ",";
      w(`    (v_mod, ${txt(l.titulo)}, ${txt(l.tipo)}, ${txt(l.etiqueta)}, ${bool(l.opcional)}, ${bool(l.preview)}, ${txt(l.cta ?? "ninguno")},`);
      w(`     ${json(l.contenido)}, ${j}, false, 'guion')${coma}`);
    });
    w();
  });
};

w("-- Plantilla del curso “Docerola Tumbada” + la mentoría grupal (oculta).");
w("-- GENERADO por scripts/curso-docerola/generar-seed.mjs desde temario.mjs — no editar a mano.");
w("-- Requiere supabase-cursos-v2.sql. Idempotente: si el curso ya existe, no hace nada");
w("-- (así nunca pisa lo que ya escribiste en el panel).");
w("-- Todas las lecciones nacen SIN publicar: el alumno no ve nada hasta que la grabes y la publiques.");
w();
w("do $$");
w("declare");
w("  v_curso uuid;");
w("  v_mentoria uuid;");
w("  v_mod uuid;");
w("begin");
w(`  if exists (select 1 from public.cursos where slug = ${txt(CURSO.slug)}) then`);
w(`    raise notice 'El curso ${CURSO.slug} ya existe: no se toca nada.';`);
w("    return;");
w("  end if;");
w();
w("  -- Mentoría (tipo 'mentoria'): nadie la ve hasta que se le dé acceso a alguien.");
w("  insert into public.cursos (slug, titulo, descripcion, activo, tipo)");
w(`    values (${txt(MENTORIA.slug)}, ${txt(MENTORIA.titulo)}, ${txt(MENTORIA.descripcion)}, true, 'mentoria')`);
w("    returning id into v_mentoria;");
bloqueModulos("v_mentoria", MENTORIA.modulos);
w();
w("  -- El curso. Nace oculto (activo = false) hasta que decidas lanzarlo; la mentoría");
w("  -- queda ligada pero apagada (estado 'oculta').");
w("  insert into public.cursos (slug, titulo, descripcion, activo, tipo, revisiones_incluidas, config)");
w(`    values (${txt(CURSO.slug)}, ${txt(CURSO.titulo)}, ${txt(CURSO.descripcion)}, false, 'curso', ${CURSO.revisiones_incluidas},`);
w(`      jsonb_build_object('meta_semanal_min', ${CURSO.config.meta_semanal_min}, 'landing', ${json(CURSO.config.landing)},`);
w(`        'mentoria', jsonb_build_object('estado', 'oculta', 'curso_id', v_mentoria::text, 'precio_mes', null)))`);
w("    returning id into v_curso;");
w();
bloqueModulos("v_curso", MODULOS);
w("end $$;");

writeFileSync(destino, lineas.join("\n") + "\n", "utf8");
console.log(`OK → ${destino}: ${MODULOS.length} módulos, ${totalLecciones} lecciones.`);
