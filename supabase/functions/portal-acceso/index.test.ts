// Pruebas de integracion contra la funcion real, stack local corriendo
// (`supabase start`). Usa las cuentas de personal sembradas por
// supabase/seed.sql (solo hace login, no las modifica) y un propietario
// sembrado sin correo (id_propietario 4 o 6, "Diego"/"Carlos" en el seed) --
// la llamada sobre el es 'omitido: sin_correo', no crea nada, repetible sin
// limpieza.
// Correr con: deno test --allow-net --allow-env supabase/functions
import { assertEquals } from 'jsr:@std/assert@1';
import { describe, it } from 'jsr:@std/testing@1/bdd';

const API_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`No se pudo iniciar sesión con ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function llamarPortalAcceso(body: Record<string, unknown>, jwt?: string) {
  const headers: Record<string, string> = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API_URL}/functions/v1/portal-acceso`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('portal-acceso: autorización (RF-042 -- solo Recepción activa)', () => {
  it('sin Authorization responde 401', async () => {
    const { status } = await llamarPortalAcceso({ idPropietario: 1, accion: 'automatico' });
    assertEquals(status, 401);
  });

  it('con JWT de veterinario responde 403', async () => {
    const jwt = await login('veterinario@vetcare.local', 'VetCare#2026');
    const { status, body } = await llamarPortalAcceso({ idPropietario: 1, accion: 'automatico' }, jwt);
    assertEquals(status, 403);
    assertEquals(body.error, 'Solo Recepción puede emitir acceso al portal.');
  });
});

describe('portal-acceso: accion automatico (RF-042 ampliado, ver CLAUDE.md sección 14)', () => {
  it('propietario sin correo responde {omitido:"sin_correo"}, sin crear nada', async () => {
    const jwt = await login('recepcion@vetcare.local', 'VetCare#2026');
    // id_propietario 4: "Diego Fernando Ramírez Ortiz", sembrado sin correo.
    const { status, body } = await llamarPortalAcceso({ idPropietario: 4, accion: 'automatico' }, jwt);
    assertEquals(status, 200);
    assertEquals(body, { omitido: 'sin_correo' });
  });
});
