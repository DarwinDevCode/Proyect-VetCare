// VetCare - Edge Function portal-acceso.
//
// Segundo caso del mismo patron que admin-usuarios/index.ts: crear la cuenta de
// portal de un propietario toca auth.users (fuera del esquema que expone la API de
// datos, RI-007), asi que no puede resolverse con un INSERT normal via PostgREST.
// Requiere la service_role key, que nunca debe llegar al navegador -- por eso vive
// aqui y no en el cliente. Verifica ella misma que quien llama es un Recepcionista
// activo, igual que admin-usuarios verifica su propio rol pese a usar la
// service_role key.
//
// Tres acciones (mismo patron de 'accion' que admin-usuarios), ver CLAUDE.md
// seccion 14 (ampliacion posterior a la Fase 5) para el detalle completo:
//   - 'manual' (default, RF-042 original): Recepcion escribe correo+password a
//     mano desde AccesoPortalDialog.tsx. Sin cambios de comportamiento.
//   - 'automatico': se dispara sola al registrar un paciente (NuevoPacienteDialog.tsx).
//     Sin correo/password del caller -- toma el correo de la ficha del propietario y
//     genera una contraseña temporal al azar. Idempotente: si ya tiene cuenta o no
//     tiene correo, responde 200 con 'omitido', nunca error (no debe bloquear el
//     alta del paciente).
//   - 'restablecer': genera una contraseña nueva y la reenvia por correo. Es el
//     mecanismo de recuperacion para cuando el envio automatico fallo la primera
//     vez (o el propietario perdio el acceso) -- admin-usuarios no sirve para esto,
//     opera sobre public.usuario (personal), no sobre propietario/cuentas de portal.

import { createClient } from 'jsr:@supabase/supabase-js@2';
// Compartido con portal-olvide-password (ver _shared/portalPassword.ts): la
// generacion de contraseña temporal y el envio de correo son exactamente la
// misma operacion en ambas funciones, solo cambia quien la dispara.
import { enviarCredencialesPortal, generarPasswordTemporal } from '../_shared/portalPassword.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return json({ error: 'Falta el token de autorización.' }, 401);

  // Origin del navegador que llama a esta funcion (mismo origen que sirve la SPA
  // -- localhost:5173 en dev, el dominio real en produccion). Se usa para armar la
  // URL completa a /portal/ingresar en el correo de credenciales: una ruta relativa
  // sin dominio no le sirve de nada al propietario, que la recibe fuera de la app
  // (bug real, ver CLAUDE.md seccion 14).
  const origenFrontend = req.headers.get('origin');
  const urlPortal = origenFrontend ? `${origenFrontend}/portal/ingresar` : null;

  // Cliente con el JWT de quien llama: para saber quien es sin saltarse RLS.
  const clienteInvocador = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: sesion, error: errorSesion } = await clienteInvocador.auth.getUser(jwt);
  if (errorSesion || !sesion.user) return json({ error: 'Sesión inválida.' }, 401);

  const { data: perfil, error: errorPerfil } = await clienteInvocador
    .from('usuario')
    .select('id_usuario, activo, rol:id_rol(codigo)')
    .eq('id_usuario', sesion.user.id)
    .single();

  const rolInvocador = (perfil as unknown as { rol: { codigo: string } | null } | null)?.rol?.codigo;
  if (errorPerfil || !perfil || !perfil.activo || rolInvocador !== 'recepcionista') {
    return json({ error: 'Solo Recepción puede emitir acceso al portal.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const accion = (body.accion as string | undefined) ?? 'manual';
  const { idPropietario } = body as { idPropietario?: number };
  if (!idPropietario) return json({ error: 'Falta el propietario.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: propietario, error: errorPropietario } = await admin
      .from('propietario')
      .select('id_propietario, id_usuario_portal, correo, nombres, apellidos')
      .eq('id_propietario', idPropietario)
      .single();

    if (errorPropietario || !propietario) {
      return json({ error: 'El propietario indicado no existe.' }, 400);
    }

    const nombreCompleto = `${propietario.nombres} ${propietario.apellidos}`;

    if (accion === 'manual') {
      const { correo, password } = body as { correo?: string; password?: string };
      if (!correo || !password) {
        return json({ error: 'Faltan datos obligatorios: propietario, correo y contraseña.' }, 400);
      }
      if (propietario.id_usuario_portal) {
        return json({ error: 'Este propietario ya tiene una cuenta de portal activa.' }, 400);
      }
      const resultado = await crearCuentaPortal(admin, idPropietario, correo, password);
      if ('error' in resultado) return json({ error: resultado.error }, 400);
      return json({ idUsuarioPortal: resultado.idUsuarioPortal });
    }

    if (accion === 'automatico') {
      // Idempotente y de mejor esfuerzo a proposito: se dispara sola al
      // registrar cualquier paciente (NuevoPacienteDialog.tsx) y nunca debe
      // bloquear ese alta -- 'omitido' no es un error, es 200.
      if (propietario.id_usuario_portal) return json({ omitido: 'ya_existe' });
      if (!propietario.correo) return json({ omitido: 'sin_correo' });

      const password = generarPasswordTemporal();
      const resultado = await crearCuentaPortal(admin, idPropietario, propietario.correo, password);
      if ('error' in resultado) return json({ error: resultado.error }, 400);

      let envioCorreoFallido = false;
      try {
        await enviarCredencialesPortal({
          correo: propietario.correo,
          nombrePropietario: nombreCompleto,
          password,
          esNuevaCuenta: true,
          urlPortal,
        });
      } catch {
        // La cuenta NO se revierte por esto: revertir dejaria al propietario sin
        // acceso pese a que la cuenta es perfectamente recuperable con 'restablecer'.
        envioCorreoFallido = true;
      }

      return json({ idUsuarioPortal: resultado.idUsuarioPortal, ...(envioCorreoFallido && { envioCorreoFallido: true }) });
    }

    if (accion === 'restablecer') {
      // Mecanismo de recuperacion: 'automatico' no revierte la cuenta si el
      // correo falla, asi que esta es la unica forma de recuperar el acceso
      // (admin-usuarios opera sobre public.usuario, no sirve para propietario).
      if (!propietario.id_usuario_portal) {
        return json(
          { error: 'Este propietario todavía no tiene acceso al portal. Usa "Dar acceso al portal" primero.' },
          400,
        );
      }
      if (!propietario.correo) {
        return json(
          { error: 'El propietario no tiene correo registrado; actualiza su ficha antes de reenviar el acceso.' },
          400,
        );
      }

      const password = generarPasswordTemporal();
      const { error: errorReset } = await admin.auth.admin.updateUserById(propietario.id_usuario_portal, { password });
      if (errorReset) return json({ error: errorReset.message }, 400);

      let envioCorreoFallido = false;
      try {
        await enviarCredencialesPortal({
          correo: propietario.correo,
          nombrePropietario: nombreCompleto,
          password,
          esNuevaCuenta: false,
          urlPortal,
        });
      } catch {
        envioCorreoFallido = true;
      }

      return json({ ok: true, ...(envioCorreoFallido && { envioCorreoFallido: true }) });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
  }
});

type ResultadoCrearCuenta = { idUsuarioPortal: string } | { error: string };

async function crearCuentaPortal(
  admin: ReturnType<typeof createClient>,
  idPropietario: number,
  correo: string,
  password: string,
): Promise<ResultadoCrearCuenta> {
  const { data: nuevo, error: errorCrear } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
  });
  if (errorCrear || !nuevo.user) {
    return { error: errorCrear?.message ?? 'No se pudo crear la cuenta de acceso.' };
  }

  const { error: errorVincular } = await admin
    .from('propietario')
    .update({ id_usuario_portal: nuevo.user.id })
    .eq('id_propietario', idPropietario);

  if (errorVincular) {
    // Sin el vinculo la cuenta de auth queda huerfana e inutilizable
    // (fn_propietario_actual() no le resuelve ningun propietario); se revierte.
    await admin.auth.admin.deleteUser(nuevo.user.id);
    return { error: errorVincular.message };
  }

  return { idUsuarioPortal: nuevo.user.id };
}
