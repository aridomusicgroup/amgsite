// Pruebas del alta en la nómina (`equipo`) al dar de alta un usuario en Ajustes.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { asegurarEnNomina, nombreParaNomina } from "./equipo-nomina.ts";

/** Cliente de mentira: sólo lo que el módulo toca (`equipo`: select e insert). */
function falsoSb({ filas = [], errorLeer = null, errorInsertar = null, lanza = null } = {}) {
  const insertadas = [];
  return {
    insertadas,
    from(tabla) {
      assert.equal(tabla, "equipo");
      if (lanza) throw lanza;
      return {
        select: async () => ({ data: errorLeer ? null : filas, error: errorLeer }),
        insert: async (fila) => { insertadas.push(fila); return { error: errorInsertar }; },
      };
    },
  };
}

test("el nombre escrito se respeta, recortado", () => {
  assert.equal(nombreParaNomina("  Rodrigo Pérez ", "rodrigo@arido.mx"), "Rodrigo Pérez");
});

test("sin nombre sale del correo, con mayúscula inicial", () => {
  assert.equal(nombreParaNomina(null, "rodrigo@arido.mx"), "Rodrigo");
  assert.equal(nombreParaNomina("   ", "rodrigo.perez@arido.mx"), "Rodrigo Perez");
  assert.equal(nombreParaNomina(undefined, "rodri_go-x@arido.mx"), "Rodri Go X");
});

test("quien no está en la nómina entra como colaborador con pago 0", async () => {
  const sb = falsoSb({ filas: [{ id: "1", email: "otro@arido.mx" }] });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "creada" });
  assert.equal(sb.insertadas.length, 1);
  assert.deepEqual(
    { ...sb.insertadas[0], notas: undefined },
    {
      nombre: "Rodrigo", email: "rodrigo@arido.mx", rol: "colaborador",
      participacion_pct: 0, pago_base: 0, periodicidad: "semanal", pago_variable: false,
      activo: true, notas: undefined,
    },
  );
});

test("el correo se guarda en minúsculas y sin espacios", async () => {
  const sb = falsoSb();
  await asegurarEnNomina(sb, { email: "  Rodrigo@Arido.MX ", nombre: null });
  assert.equal(sb.insertadas[0].email, "rodrigo@arido.mx");
  assert.equal(sb.insertadas[0].nombre, "Rodrigo");
});

test("si ya tiene fila (aunque con otras mayúsculas) no se duplica", async () => {
  const sb = falsoSb({ filas: [{ id: "7", email: "Rodrigo@Arido.mx", activo: true }] });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "existente" });
  assert.equal(sb.insertadas.length, 0);
});

test("una fila inactiva no se reactiva sola ni se duplica", async () => {
  const sb = falsoSb({ filas: [{ id: "7", email: "rodrigo@arido.mx", activo: false }] });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "existente" });
  assert.equal(sb.insertadas.length, 0);
});

test("filas sin correo en la nómina no estorban", async () => {
  const sb = falsoSb({ filas: [{ id: "1", email: null }, { id: "2" }] });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.equal(r.estado, "creada");
});

test("si no se puede leer la nómina avisa y no inserta a ciegas", async () => {
  const sb = falsoSb({ errorLeer: { message: "boom leer" } });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "fallida", error: "boom leer" });
  assert.equal(sb.insertadas.length, 0);
});

test("si el insert falla avisa con el mensaje", async () => {
  const sb = falsoSb({ errorInsertar: { message: "boom insertar" } });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "fallida", error: "boom insertar" });
});

test("una excepción del cliente no tumba el alta: vuelve como fallida", async () => {
  const sb = falsoSb({ lanza: new Error("sin red") });
  const r = await asegurarEnNomina(sb, { email: "rodrigo@arido.mx", nombre: "Rodrigo" });
  assert.deepEqual(r, { estado: "fallida", error: "sin red" });
});
