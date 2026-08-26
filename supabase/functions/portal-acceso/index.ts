// VetCare - Edge Function portal-acceso.
//
// Segundo caso del mismo patron que admin-usuarios/index.ts: crear la cuenta de
// portal de un propietario toca auth.users (fuera del esquema que expone la API de
// datos, RI-007), asi que no puede resolverse con un INSERT normal via PostgREST.
// Requiere la service_role key, que nunca debe llegar al navegador -- por eso vive
// aqui y no en el cliente. Verifica ella misma que quien llama es un Recepcionista
// activo (RF-042: el acceso lo emite Recepcion desde la ficha del propietario, no
// un autoregistro publico), igual que admin-usuarios verifica su propio rol pese a
// usar la service_role key.

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  const { idPropietario, correo, password } = body as {
    idPropietario?: number; correo?: string; password?: string;
  };
  if (!idPropietario || !correo || !password) {
    return json({ error: 'Faltan datos obligatorios: propietario, correo y contraseña.' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: propietario, error: errorPropietario } = await admin
      .from('propietario')
      .select('id_propietario, id_usuario_portal')
      .eq('id_propietario', idPropietario)
      .single();

    if (errorPropietario || !propietario) {
      return json({ error: 'El propietario indicado no existe.' }, 400);
    }
    if (propietario.id_usuario_portal) {
      return json({ error: 'Este propietario ya tiene una cuenta de portal activa.' }, 400);
    }

    const { data: nuevo, error: errorCrear } = await admin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
    });
    if (errorCrear || !nuevo.user) {
      return json({ error: errorCrear?.message ?? 'No se pudo crear la cuenta de acceso.' }, 400);
    }

    const { error: errorVincular } = await admin
      .from('propietario')
      .update({ id_usuario_portal: nuevo.user.id })
      .eq('id_propietario', idPropietario);

    if (errorVincular) {
      // Sin el vinculo la cuenta de auth queda huerfana e inutilizable
      // (fn_propietario_actual() no le resuelve ningun propietario); se revierte.
      await admin.auth.admin.deleteUser(nuevo.user.id);
      return json({ error: errorVincular.message }, 400);
    }

    return json({ idUsuarioPortal: nuevo.user.id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
  }
});
