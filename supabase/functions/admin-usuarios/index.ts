// VetCare - Edge Function admin-usuarios.
//
// Cubre las tres acciones del ciclo de vida de una cuenta que no pueden
// resolverse con un INSERT/UPDATE normal via PostgREST porque tocan
// auth.users (fuera del esquema que expone la API de datos, RI-007): crear
// cuenta, activar/desactivar (bloqueo real en GoTrue, no solo la bandera
// usuario.activo que ya corta el acceso via RLS) y restablecer contrasena.
//
// Requiere la service_role key, que nunca debe llegar al navegador -- por eso
// vive aqui y no en el cliente. Verifica ella misma que quien llama es un
// Administrador activo, igual que fn_emitir_factura verifica su propio rol
// pese a ser SECURITY DEFINER (mismo patron, documentado en CLAUDE.md #6).

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
  if (errorPerfil || !perfil || !perfil.activo || rolInvocador !== 'administrador') {
    return json({ error: 'Solo un Administrador activo puede realizar esta acción.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const accion = body.accion as string;

  try {
    if (accion === 'crear') {
      const { correo, password, nombres, apellidos, idRol } = body as {
        correo?: string; password?: string; nombres?: string; apellidos?: string; idRol?: number;
      };
      if (!correo || !password || !nombres || !apellidos || !idRol) {
        return json({ error: 'Faltan datos obligatorios: correo, contraseña, nombres, apellidos y rol.' }, 400);
      }

      const { data: nuevo, error: errorCrear } = await admin.auth.admin.createUser({
        email: correo,
        password,
        email_confirm: true,
      });
      if (errorCrear || !nuevo.user) {
        return json({ error: errorCrear?.message ?? 'No se pudo crear la cuenta de acceso.' }, 400);
      }

      const { error: errorInsertPerfil } = await admin
        .from('usuario')
        .insert({ id_usuario: nuevo.user.id, id_rol: idRol, nombres, apellidos, correo });
      if (errorInsertPerfil) {
        // Sin la fila en public.usuario la cuenta de auth queda huerfana e
        // inutilizable (fn_rol_actual() no le resuelve ningun rol); se revierte.
        await admin.auth.admin.deleteUser(nuevo.user.id);
        return json({ error: errorInsertPerfil.message }, 400);
      }

      return json({ idUsuario: nuevo.user.id });
    }

    if (accion === 'activar' || accion === 'desactivar') {
      const { idUsuario } = body as { idUsuario?: string };
      if (!idUsuario) return json({ error: 'Falta el usuario a modificar.' }, 400);
      const activar = accion === 'activar';

      // Bloqueo real en GoTrue (impide iniciar sesion), ademas de la bandera
      // usuario.activo (corta el acceso a datos via fn_rol_actual() aunque el
      // JWT ya emitido siga siendo valido hasta que expire).
      const { error: errorBan } = await admin.auth.admin.updateUserById(idUsuario, {
        ban_duration: activar ? 'none' : '876000h',
      });
      if (errorBan) return json({ error: errorBan.message }, 400);

      const { error: errorActivo } = await admin
        .from('usuario')
        .update({ activo: activar })
        .eq('id_usuario', idUsuario);
      if (errorActivo) return json({ error: errorActivo.message }, 400);

      return json({ ok: true });
    }

    if (accion === 'restablecerContrasena') {
      const { idUsuario, password } = body as { idUsuario?: string; password?: string };
      if (!idUsuario || !password) return json({ error: 'Faltan datos obligatorios.' }, 400);

      const { error: errorReset } = await admin.auth.admin.updateUserById(idUsuario, { password });
      if (errorReset) return json({ error: errorReset.message }, 400);

      return json({ ok: true });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
  }
});
