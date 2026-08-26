// Pruebas de integracion contra la funcion real (portal-olvide-password),
// stack local corriendo (`supabase start`). Vive en supabase/tests/, no
// junto a la funcion, a pedido explicito del cliente (ver README.md de esta
// carpeta). No arrancan el stack ellas mismas -- si no esta corriendo,
// fallan con un error de conexion claro, no un timeout silencioso.
// Correr con: deno test --allow-net --allow-env supabase/tests
//
// Usan un propietario sembrado SIN correo/portal (id_propietario 6, "Carlos
// Alberto" en seed.sql) al que se le asigna temporalmente un correo de
// prueba + cuenta de portal en beforeAll, revertido en afterAll -- nunca el
// propietario sembrado real (propietario@vetcare.local): reutilizarlo le
// cambiaria la contraseña y le mandaria un correo real en cada corrida.
//
// No se usa INSERT/DELETE sobre propietario a proposito: service_role solo
// tiene GRANT de SELECT/UPDATE en esa tabla (ver CLAUDE.md seccion 9, Fase 5
// RI-008) -- ampliarlo solo para conveniencia de las pruebas seria dar mas
// privilegio del que la aplicacion realmente necesita.
import { assertEquals } from 'jsr:@std/assert@1';
import { afterAll, beforeAll, describe, it } from 'jsr:@std/testing@1/bdd';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const API_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
// Claves del proyecto local por defecto (`supabase status`) -- no son
// secretos reales, son las fijas de cualquier stack local de Supabase.
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(API_URL, SERVICE_ROLE_KEY);
const CORREO_PRUEBA = `test-olvide-${crypto.randomUUID().slice(0, 8)}@example.com`;
const ID_PROPIETARIO_PRESTADO = 6; // "Carlos Alberto Jiménez Salazar", sembrado sin correo/portal.

let idUsuarioPrueba: string;

async function llamarOlvidePassword(correo: string | undefined) {
  const res = await fetch(`${API_URL}/functions/v1/portal-olvide-password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(correo === undefined ? {} : { correo }),
  });
  return { status: res.status, body: await res.json() };
}

describe('portal-olvide-password', () => {
  beforeAll(async () => {
    const { data: nuevoUsuario, error: errorUsuario } = await admin.auth.admin.createUser({
      email: CORREO_PRUEBA,
      password: 'PasswordInicialDePrueba123',
      email_confirm: true,
    });
    if (errorUsuario || !nuevoUsuario.user) {
      throw new Error(`No se pudo crear el usuario de prueba: ${errorUsuario?.message}`);
    }
    idUsuarioPrueba = nuevoUsuario.user.id;

    const { error: errorPropietario } = await admin
      .from('propietario')
      .update({ correo: CORREO_PRUEBA, id_usuario_portal: idUsuarioPrueba })
      .eq('id_propietario', ID_PROPIETARIO_PRESTADO);
    if (errorPropietario) {
      throw new Error(`No se pudo preparar el propietario de prueba: ${errorPropietario.message}`);
    }
  });

  afterAll(async () => {
    // Revierte el propietario prestado a su estado sembrado original (sin
    // correo, sin portal) y borra la cuenta de auth desechable -- no toca la
    // fila de propietario en sí (RF-033, sin borrado físico; y de todas
    // formas service_role no tiene GRANT de DELETE en esa tabla).
    await admin.from('propietario').update({ correo: null, id_usuario_portal: null }).eq('id_propietario', ID_PROPIETARIO_PRESTADO);
    if (idUsuarioPrueba) await admin.auth.admin.deleteUser(idUsuarioPrueba);
  });

  it('correo existente responde {ok:true}', async () => {
    const { status, body } = await llamarOlvidePassword(CORREO_PRUEBA);
    assertEquals(status, 200);
    assertEquals(body, { ok: true });
  });

  it('correo inexistente responde EXACTAMENTE igual (no enumeración de cuentas)', async () => {
    const { status, body } = await llamarOlvidePassword('nadie@nunca-existio-en-vetcare.example');
    assertEquals(status, 200);
    assertEquals(body, { ok: true });
  });

  it('body sin correo es un error real (400)', async () => {
    const { status, body } = await llamarOlvidePassword(undefined);
    assertEquals(status, 400);
    assertEquals(typeof body.error, 'string');
  });
});
