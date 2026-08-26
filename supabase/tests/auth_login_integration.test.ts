// Prueba de INTEGRACION (no pgTAP): a diferencia del resto de este directorio
// (pruebas .sql sobre la base), esta llama al servicio de Auth real
// (GoTrue) del stack local -- el mismo endpoint que usa
// supabase.auth.signInWithPassword() desde el cliente (AuthContext.tsx /
// PortalAuthContext.tsx). Los .test.tsx de src/test/ prueban la LOGICA del
// formulario con el cliente de Supabase mockeado; esta prueba, en cambio,
// confirma que el propio servidor de Auth se comporta como esa logica
// asume: credenciales incorrectas rechazadas, correctas aceptadas.
//
// No arranca el stack por si sola -- si no esta corriendo (`supabase
// start`), falla con un error de conexion claro, no un timeout silencioso.
// Correr con: deno test --allow-net --allow-env supabase/tests/auth_login_integration.test.ts
import { assertEquals, assertExists } from 'jsr:@std/assert@1';
import { describe, it } from 'jsr:@std/testing@1/bdd';

const API_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
// Clave anon fija del stack local por defecto (`supabase status`) -- no es
// un secreto real, es la misma que usan los demas .test.ts de este proyecto.
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Cuenta sembrada real (seed.sql seccion 3) -- no se crea ni se borra nada,
// solo se lee su comportamiento de login.
const CORREO_VALIDO = 'recepcion@vetcare.local';
const PASSWORD_VALIDO = 'VetCare#2026';

async function intentarLogin(correo: string, password: string) {
  const res = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password }),
  });
  return { status: res.status, body: await res.json() };
}

describe('login (personal y portal) -- Auth real del stack local', () => {
  // Caso pedido explicitamente por el cliente: entrar con datos incorrectos.
  it('contraseña incorrecta es rechazada (400, invalid_grant) y no entrega token', async () => {
    const { status, body } = await intentarLogin(CORREO_VALIDO, 'estaContraseñaEsIncorrecta');
    assertEquals(status, 400);
    assertEquals(body.error_code, 'invalid_credentials');
    assertEquals(body.access_token, undefined);
  });

  it('correo inexistente responde el MISMO error que una contraseña incorrecta (no enumeración de cuentas)', async () => {
    const { status, body } = await intentarLogin('nadie@nunca-existio-en-vetcare.example', 'cualquierCosa123');
    assertEquals(status, 400);
    assertEquals(body.error_code, 'invalid_credentials');
  });

  it('correo o contraseña vacíos son rechazados sin llegar a validar contra la base', async () => {
    const { status } = await intentarLogin('', '');
    assertEquals(status, 400);
  });

  it('credenciales correctas entregan un access_token real', async () => {
    const { status, body } = await intentarLogin(CORREO_VALIDO, PASSWORD_VALIDO);
    assertEquals(status, 200);
    assertExists(body.access_token);
    assertEquals(body.token_type, 'bearer');
  });
});
