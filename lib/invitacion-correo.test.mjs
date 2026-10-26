// Pruebas del correo de invitación al panel (enlace + contenido, sin mandar nada).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enlaceDeInvitacion, esTipoOtp, contenidoInvitacion, SITIO_PANEL,
} from "./invitacion-correo.ts";

test("el enlace pasa por la confirmación del panel y termina en crear contraseña", () => {
  const url = enlaceDeInvitacion("abc123", "magiclink");
  assert.equal(
    url,
    `${SITIO_PANEL}/admin/auth/confirm?token_hash=abc123&type=magiclink&next=%2Fadmin%2Fauth%2Fset-password`,
  );
});

test("el token se codifica para no romper la URL", () => {
  const url = enlaceDeInvitacion("a b&c=d", "signup");
  assert.ok(url.includes("token_hash=a%20b%26c%3Dd&type=signup"));
});

test("el destino es una ruta local del panel (la confirmación sólo acepta /admin)", () => {
  const u = new URL(enlaceDeInvitacion("t", "magiclink"));
  assert.ok(u.searchParams.get("next")?.startsWith("/admin"));
});

test("acepta los tipos que genera Supabase y rechaza el resto", () => {
  for (const t of ["magiclink", "signup", "invite", "recovery", "email"]) assert.equal(esTipoOtp(t), true);
  for (const t of ["", "admin", "email_change", null, undefined, 3]) assert.equal(esTipoOtp(t), false);
});

test("el correo saluda por nombre, dice el rol y trae el botón con el enlace", () => {
  const url = enlaceDeInvitacion("tok", "magiclink");
  const c = contenidoInvitacion({ nombre: "Martín López", rol: "produccion", url });
  assert.match(c.subject, /panel/i);
  assert.ok(c.content.includes("Martín"), "saluda con el primer nombre");
  assert.ok(c.content.includes("Producción"), "nombra el rol");
  assert.ok(c.content.includes(`href="${url}"`), "el botón lleva el enlace");
  assert.ok(c.content.includes(url), "el enlace también va en texto por si el botón falla");
});

test("sin nombre no queda un saludo roto", () => {
  const c = contenidoInvitacion({ nombre: null, rol: "crm", url: "https://x.test/a" });
  assert.ok(!c.content.includes("null"));
  assert.ok(!c.content.includes("undefined"));
  assert.ok(c.content.includes("CRM / Marketing"));
});

test("el nombre se escapa: no deja meter HTML en el correo", () => {
  const c = contenidoInvitacion({ nombre: '<script>alert(1)</script> "Eve"', rol: "admin", url: "https://x.test/a" });
  assert.ok(!c.content.includes("<script>"));
  assert.ok(c.content.includes("&lt;script&gt;"));
});

test("un rol desconocido no rompe el correo", () => {
  const c = contenidoInvitacion({ nombre: "Ana", rol: "otro", url: "https://x.test/a" });
  assert.ok(c.content.includes("otro"));
});
