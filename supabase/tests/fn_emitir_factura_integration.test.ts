// Prueba de INTEGRACION: llama a fn_emitir_factura(...) via PostgREST
// (/rest/v1/rpc/...) con un JWT real, exactamente como lo hace
// NuevaFacturaDialog.tsx -- no un mock. Cierra un hueco real de la suite
// (ver supabase/tests/README.md, tabla de pruebas funcionales, fila del
// Módulo 5: "RN-013/atomicidad de fn_emitir_factura sigue solo verificada
// por curl"): RN-012 (propietario correcto), RN-013 (no se puede facturar
// dos veces la misma atención), atomicidad (una línea inválida no deja una
// cabecera huérfana) y que solo Recepción puede invocarla.
//
// No arranca el stack por si sola -- si no esta corriendo (`supabase
// start`), falla con un error de conexion claro. Correr sola con:
// deno test --allow-net --allow-env supabase/tests/fn_emitir_factura_integration.test.ts
// (o junto con el resto: deno test --allow-net --allow-env supabase/tests --
// la nota de higiene de datos de abajo aplica igual en ese caso.)
//
// Nota de higiene de datos: a diferencia de las pruebas pgTAP (que envuelven
// todo en BEGIN/ROLLBACK), una prueba HTTP no puede revertir una
// transacción del servidor después de que termina. RF-033 (sin borrado
// físico) además significa que `factura`/`consulta` no tienen política
// DELETE ni para `service_role`. Esta prueba, entonces, deja un puñado de
// filas de prueba permanentes (una consulta y dos facturas) cada vez que
// corre -- igual que cualquier `curl` de verificación manual ya documentado
// en CLAUDE.md. Si eso no es aceptable en un entorno dado, correr
// `supabase db reset` después.
import { assertEquals, assertExists, assertNotEquals } from 'jsr:@std/assert@1';
import { beforeAll, describe, it } from 'jsr:@std/testing@1/bdd';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const API_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const VETERINARIO_UUID = '00000000-0000-0000-0000-000000000002'; // sembrado, seed.sql sección 3.
const admin = createClient(API_URL, SERVICE_ROLE_KEY);

async function obtenerAccessToken(correo: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`No se pudo autenticar ${correo}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function emitirFactura(accessToken: string, args: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/rest/v1/rpc/fn_emitir_factura`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json();
  return { status: res.status, body };
}

let tokenRecepcion: string;
let tokenVeterinario: string;
let idConsultaFixture: number;
let idPropietarioFixture: number;

describe('fn_emitir_factura -- RPC real (RF-028/RN-012/RN-013/RN-014)', () => {
  beforeAll(async () => {
    tokenRecepcion = await obtenerAccessToken('recepcion@vetcare.local', 'VetCare#2026');
    tokenVeterinario = await obtenerAccessToken('veterinario@vetcare.local', 'VetCare#2026');

    // Fixture propio (no depende de qué consultas del seed ya estén
    // facturadas): un paciente sembrado real (Toby, id 1) con una consulta
    // nueva sin facturar, creada directo con service_role.
    const { data: paciente, error: errorPaciente } = await admin
      .from('paciente')
      .select('id_paciente, id_propietario')
      .eq('id_paciente', 1)
      .single();
    if (errorPaciente || !paciente) throw new Error(`No se encontró el paciente fixture: ${errorPaciente?.message}`);
    idPropietarioFixture = paciente.id_propietario;

    const { data: consulta, error: errorConsulta } = await admin
      .from('consulta')
      .insert({
        id_paciente: paciente.id_paciente,
        id_veterinario: VETERINARIO_UUID,
        motivo: '[prueba de integración] fn_emitir_factura',
        diagnostico: '[prueba de integración]',
      })
      .select('id_consulta')
      .single();
    if (errorConsulta || !consulta) throw new Error(`No se pudo crear la consulta fixture: ${errorConsulta?.message}`);
    idConsultaFixture = consulta.id_consulta;
  });

  it('un Veterinario no puede emitir facturas (403/42501, RLS de SECURITY DEFINER)', async () => {
    const { status, body } = await emitirFactura(tokenVeterinario, {
      p_id_propietario: idPropietarioFixture,
      p_lineas: [{ id_producto: null, descripcion: 'Servicio', cantidad: 1, precio_unitario: 5 }],
    });
    assertEquals(status, 403);
    assertEquals(body.code, '42501');
  });

  it('sin propietario ni consulta, el mensaje de error es legible (no un código genérico)', async () => {
    const { status, body } = await emitirFactura(tokenRecepcion, { p_porcentaje_impuesto: 15 });
    assertEquals(status, 400);
    assertEquals(body.message, 'Debe indicarse el propietario o la atencion a facturar.');
  });

  it('servicio suelto (sin atención asociada): calcula subtotal/impuesto/total correctamente', async () => {
    const { status, body: idFactura } = await emitirFactura(tokenRecepcion, {
      p_id_propietario: idPropietarioFixture,
      p_porcentaje_impuesto: 15,
      p_lineas: [
        { id_producto: null, descripcion: '[prueba] Baño y peluquería', cantidad: 1, precio_unitario: 20 },
        { id_producto: null, descripcion: '[prueba] Corte de uñas', cantidad: 1, precio_unitario: 5 },
      ],
    });
    assertEquals(status, 200);
    assertExists(idFactura);

    const { data: factura } = await admin.from('factura').select('subtotal, impuesto, total').eq('id_factura', idFactura).single();
    assertEquals(Number(factura?.subtotal), 25);
    assertEquals(Number(factura?.impuesto), 3.75);
    assertEquals(Number(factura?.total), 28.75);
  });

  it('facturar una atención por primera vez funciona (RF-028)', async () => {
    const { status, body: idFactura } = await emitirFactura(tokenRecepcion, {
      p_id_consulta: idConsultaFixture,
      p_porcentaje_impuesto: 15,
      p_lineas: [{ id_producto: null, descripcion: '[prueba] Consulta general', cantidad: 1, precio_unitario: 15 }],
    });
    assertEquals(status, 200);
    assertExists(idFactura);

    // RN-012: el propietario de la factura es el del paciente de la
    // consulta, no uno que el cliente pudiera haber intentado forzar.
    const { data: factura } = await admin.from('factura').select('id_propietario').eq('id_factura', idFactura).single();
    assertEquals(factura?.id_propietario, idPropietarioFixture);
  });

  it('facturar la MISMA atención una segunda vez falla (RN-013, factura.id_consulta es UNIQUE)', async () => {
    const { status, body } = await emitirFactura(tokenRecepcion, {
      p_id_consulta: idConsultaFixture,
      p_porcentaje_impuesto: 15,
      p_lineas: [{ id_producto: null, descripcion: '[prueba] Duplicado', cantidad: 1, precio_unitario: 15 }],
    });
    assertEquals(status, 409);
    assertEquals(body.code, '23505');
  });

  it('una línea inválida revierte TODA la operación -- no queda una cabecera de factura huérfana (atomicidad, RES-07/RNF-005)', async () => {
    const { count: facturasAntes } = await admin.from('factura').select('*', { count: 'exact', head: true });

    const { status } = await emitirFactura(tokenRecepcion, {
      p_id_propietario: idPropietarioFixture,
      p_porcentaje_impuesto: 15,
      // cantidad no numerica: el cast (l->>'cantidad')::numeric falla a mitad
      // de la insercion de detalle_factura, DESPUES de ya haber insertado la
      // cabecera de factura -- si no fuera atomico, esa cabecera quedaria
      // huerfana, sin ninguna linea.
      p_lineas: [{ id_producto: null, descripcion: '[prueba] Linea invalida', cantidad: 'no-es-un-numero', precio_unitario: 5 }],
    });
    assertNotEquals(status, 200);

    const { count: facturasDespues } = await admin.from('factura').select('*', { count: 'exact', head: true });
    assertEquals(facturasDespues, facturasAntes);
  });
});
