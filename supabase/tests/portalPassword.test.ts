// Pruebas unitarias (sin red) de las funciones puras de
// functions/_shared/portalPassword.ts. Vive en supabase/tests/, no junto a
// la funcion, a pedido explicito del cliente (ver README.md de esta carpeta).
// Correr con: deno test --allow-net --allow-env supabase/tests
// (--allow-net hace falta porque enviarCredencialesPortal en ese mismo
// archivo importa nodemailer via npm:, aunque esta prueba no la invoque.)
import { assertEquals, assertMatch, assertNotMatch } from 'jsr:@std/assert@1';
import { generarPasswordTemporal, escaparHtml, plantillaHtml } from '../functions/_shared/portalPassword.ts';

Deno.test('generarPasswordTemporal respeta la longitud pedida', () => {
  assertEquals(generarPasswordTemporal(12).length, 12);
  assertEquals(generarPasswordTemporal(20).length, 20);
});

Deno.test('generarPasswordTemporal nunca incluye caracteres ambiguos (0/O, 1/l/I)', () => {
  // Muestra grande para que la ausencia de un caracter no sea casualidad.
  const muestra = Array.from({ length: 50 }, () => generarPasswordTemporal(30)).join('');
  assertNotMatch(muestra, /[0O1lI]/);
});

Deno.test('generarPasswordTemporal: dos llamadas seguidas no dan el mismo resultado', () => {
  const a = generarPasswordTemporal();
  const b = generarPasswordTemporal();
  assertEquals(a === b, false);
});

Deno.test('escaparHtml escapa & < > "', () => {
  assertEquals(escaparHtml('<script>alert("hola" & adios)</script>'), '&lt;script&gt;alert(&quot;hola&quot; &amp; adios)&lt;/script&gt;');
});

Deno.test('plantillaHtml sustituye correo, contraseña y URL', () => {
  const html = plantillaHtml({
    titulo: 'Acceso al Portal VetCare',
    introduccion: 'Hola Juan, se creó tu acceso.',
    correo: 'juan@example.com',
    password: 'Xg7kP2mNqR9w',
    urlPortal: 'http://localhost:5173/portal/ingresar',
    notaFinal: 'Nota final.',
  });
  assertMatch(html, /juan@example\.com/);
  assertMatch(html, /Xg7kP2mNqR9w/);
  assertMatch(html, /http:\/\/localhost:5173\/portal\/ingresar/);
});

Deno.test('plantillaHtml sin urlPortal no rompe: muestra el aviso de pedirla en la clínica', () => {
  const html = plantillaHtml({
    titulo: 'Acceso al Portal VetCare',
    introduccion: 'Hola Juan.',
    correo: 'juan@example.com',
    password: 'Xg7kP2mNqR9w',
    urlPortal: null,
    notaFinal: 'Nota final.',
  });
  assertMatch(html, /Pide la dirección del Portal del propietario en la clínica/);
});

// Regresion de XSS: un nombre de propietario con HTML/script no debe quedar
// sin escapar en el correo -- introduccion ya trae el nombre interpolado
// (ver enviarCredencialesPortal en este mismo archivo), asi que basta con
// probar que plantillaHtml escapa lo que le llega en ese campo.
Deno.test('plantillaHtml escapa HTML/script embebido en introduccion (XSS)', () => {
  const html = plantillaHtml({
    titulo: 'Acceso al Portal VetCare',
    introduccion: 'Hola <script>alert(1)</script>, se creó tu acceso.',
    correo: 'juan@example.com',
    password: 'Xg7kP2mNqR9w',
    urlPortal: null,
    notaFinal: 'Nota final.',
  });
  assertNotMatch(html, /<script>alert\(1\)<\/script>/);
  assertMatch(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
