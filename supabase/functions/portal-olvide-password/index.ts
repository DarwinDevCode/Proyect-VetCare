// VetCare - Edge Function portal-olvide-password.
//
// "Olvidé mi contraseña" desde /portal/ingresar (LoginPortalPage.tsx): a
// diferencia de portal-acceso, esta funcion NO exige que quien llama este
// autenticado como Recepcionista -- no podria, es exactamente para alguien que
// no puede entrar. Es una funcion propia, separada de portal-acceso, a
// proposito: portal-acceso asume en su primera linea de logica que quien llama
// ya es un Recepcionista activo (esa comprobacion protege tambien 'restablecer',
// que resetea la contraseña de CUALQUIER propietario dado su idPropietario) --
// meter una rama sin autenticacion ahi, aunque hoy se escriba con cuidado, deja
// la puerta abierta a que un cambio futuro la debilite por descuido. Esta
// funcion, en cambio, no tiene ninguna otra capacidad: es trivial de auditar.
//
// La "autenticacion" aqui es el patron estandar de cualquier flujo de
// "olvidé mi contraseña": tener acceso al correo registrado, no un JWT. Por
// eso usa la service_role key directo, sin cliente-con-JWT-del-invocador (no
// hay JWT, es un visitante anonimo).
//
// Nunca revela si un correo existe en el sistema (evita enumeracion de
// cuentas): con correo encontrado o no encontrado, la respuesta es identica,
// { ok: true }. Solo un body mal formado es un error real.
//
// Sin limite de tasa propio -- fuera de alcance (RES-06, equipo reducido). El
// peor escenario de abuso es spam de correos al propio dueño de la cuenta, no
// robo de credenciales: la contraseña nueva solo llega a su bandeja.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { enviarCredencialesPortal, generarPasswordTemporal } from '../_shared/portalPassword.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const RESPUESTA_GENERICA = { ok: true };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const correo = (body.correo as string | undefined)?.trim();
  if (!correo) return json({ error: 'Ingresa tu correo.' }, 400);

  // Mismo calculo que portal-acceso: URL completa a /portal/ingresar a partir
  // del origen de quien llama, para que el correo tenga un enlace usable.
  const origenFrontend = req.headers.get('origin');
  const urlPortal = origenFrontend ? `${origenFrontend}/portal/ingresar` : null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: propietario } = await admin
      .from('propietario')
      .select('id_usuario_portal, correo, nombres, apellidos')
      .ilike('correo', correo)
      .not('id_usuario_portal', 'is', null)
      .maybeSingle();

    // No encontrado (correo inexistente, sin acceso de portal, o el .ilike no
    // hizo match): responde exactamente igual que el caso exitoso. Ver
    // comentario de arriba -- nunca se revela si la cuenta existe.
    if (!propietario) return json(RESPUESTA_GENERICA);

    const password = generarPasswordTemporal();
    const { error: errorReset } = await admin.auth.admin.updateUserById(propietario.id_usuario_portal!, { password });
    if (errorReset) {
      // Un fallo real de GoTrue aca es un error nuestro, no del usuario -- no
      // hace falta ocultarlo, no revela nada sobre la existencia de la cuenta
      // que el usuario no supiera ya (esta escribiendo el correo el mismo).
      return json({ error: errorReset.message }, 500);
    }

    try {
      await enviarCredencialesPortal({
        correo: propietario.correo!,
        nombrePropietario: `${propietario.nombres} ${propietario.apellidos}`,
        password,
        esNuevaCuenta: false,
        urlPortal,
      });
    } catch (errorCorreo) {
      console.error('portal-olvide-password: fallo el envio de correo', errorCorreo);
      // La contraseña ya se cambió aunque el correo falle -- no hay forma de
      // que el usuario la sepa hasta reintentar. Mismo criterio best-effort que
      // 'automatico'/'restablecer' en portal-acceso: no revertir, y no exponer
      // este detalle en la respuesta (seguiria delatando que el correo existe).
    }

    return json(RESPUESTA_GENERICA);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
  }
});
