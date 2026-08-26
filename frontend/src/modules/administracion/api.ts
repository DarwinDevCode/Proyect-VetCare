import { supabase } from '../../lib/supabaseClient';
import type {
  EntradaAuditoriaConUsuario,
  Especie,
  ParametroSistema,
  Raza,
  Rol,
  RolCodigo,
  UsuarioConRol,
} from '../../types/dominio';

// ----------------------------------------------------------------------------
// Cuentas de usuario. Crear, activar/desactivar y restablecer contrasena pasan
// por la Edge Function admin-usuarios: tocan auth.users, que esta fuera del
// esquema que expone la API de datos (RI-007) y requiere la service_role key,
// que nunca debe llegar al navegador. Editar nombres/apellidos/rol de una
// cuenta ya existente si es un UPDATE normal via PostgREST (RLS lo restringe a
// Administrador, ver migracion ..._administracion.sql).
// ----------------------------------------------------------------------------

export async function listarUsuarios(): Promise<UsuarioConRol[]> {
  const { data, error } = await supabase
    .from('usuario')
    .select('*, rol:id_rol(*)')
    .order('apellidos');
  if (error) throw error;
  return data as unknown as UsuarioConRol[];
}

async function invocarAdminUsuarios<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body });
  if (error) {
    // supabase-js no expone el cuerpo del error de una Edge Function de forma
    // directa en `error.message` (queda en `error.context`); se intenta leerlo
    // para no perder el mensaje en espanol que sí redacta la funcion.
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.json === 'function') {
      try {
        const cuerpo = (await contexto.json()) as { error?: string };
        if (cuerpo.error) throw new Error(cuerpo.error);
      } catch {
        // sigue al mensaje generico de abajo
      }
    }
    throw new Error(error.message ?? 'No se pudo completar la operación.');
  }
  const respuesta = data as T & { error?: string };
  if (respuesta && typeof respuesta === 'object' && 'error' in respuesta && respuesta.error) {
    throw new Error(respuesta.error);
  }
  return data as T;
}

export async function crearUsuario(datos: {
  correo: string;
  password: string;
  nombres: string;
  apellidos: string;
  idRol: number;
}): Promise<{ idUsuario: string }> {
  return invocarAdminUsuarios({ accion: 'crear', ...datos });
}

export async function activarUsuario(idUsuario: string): Promise<void> {
  await invocarAdminUsuarios({ accion: 'activar', idUsuario });
}

export async function desactivarUsuario(idUsuario: string): Promise<void> {
  await invocarAdminUsuarios({ accion: 'desactivar', idUsuario });
}

export async function restablecerContrasena(idUsuario: string, password: string): Promise<void> {
  await invocarAdminUsuarios({ accion: 'restablecerContrasena', idUsuario, password });
}

export async function actualizarUsuario(
  idUsuario: string,
  datos: Partial<{ nombres: string; apellidos: string; id_rol: number }>,
): Promise<UsuarioConRol> {
  const { data, error } = await supabase
    .from('usuario')
    .update(datos)
    .eq('id_usuario', idUsuario)
    .select('*, rol:id_rol(*)')
    .single();
  if (error) throw error;
  return data as unknown as UsuarioConRol;
}

// ----------------------------------------------------------------------------
// Roles. Solo alta (AD-10): renombrar un codigo existente rompe en silencio
// toda politica RLS que lo compara como texto literal, asi que no hay UPDATE.
// Un rol nuevo queda en el catalogo sin ningun permiso real hasta que una
// migracion agregue politicas RLS que lo mencionen -- se advierte en la UI.
// ----------------------------------------------------------------------------

export async function listarRoles(): Promise<Rol[]> {
  const { data, error } = await supabase.from('rol').select('*').order('id_rol');
  if (error) throw error;
  return data;
}

export async function crearRol(datos: { codigo: string; nombre: string; descripcion: string | null }): Promise<Rol> {
  const { data, error } = await supabase.from('rol').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Catalogos: especies y razas (RNF-024, hoy solo ampliables por SQL/seed).
// ----------------------------------------------------------------------------

export async function listarEspecies(): Promise<Especie[]> {
  const { data, error } = await supabase.from('especie').select('*').order('nombre');
  if (error) throw error;
  return data;
}

export async function crearEspecie(nombre: string): Promise<Especie> {
  const { data, error } = await supabase.from('especie').insert({ nombre }).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarEspecie(id: number, nombre: string): Promise<Especie> {
  const { data, error } = await supabase
    .from('especie')
    .update({ nombre })
    .eq('id_especie', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listarRazas(): Promise<Raza[]> {
  const { data, error } = await supabase.from('raza').select('*').order('nombre');
  if (error) throw error;
  return data;
}

export async function crearRaza(idEspecie: number, nombre: string): Promise<Raza> {
  const { data, error } = await supabase
    .from('raza')
    .insert({ id_especie: idEspecie, nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarRaza(id: number, nombre: string): Promise<Raza> {
  const { data, error } = await supabase.from('raza').update({ nombre }).eq('id_raza', id).select().single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Parametros de negocio configurables.
// ----------------------------------------------------------------------------

export async function listarParametros(): Promise<ParametroSistema[]> {
  const { data, error } = await supabase.from('parametro_sistema').select('*').order('clave');
  if (error) throw error;
  return data;
}

export async function actualizarParametro(clave: string, valor: string): Promise<ParametroSistema> {
  const { data, error } = await supabase
    .from('parametro_sistema')
    .update({ valor, fecha_actualizacion: new Date().toISOString() })
    .eq('clave', clave)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Auditoria (AD-17/AD-19): bitacora de cambios sobre tablas administrativas.
// ----------------------------------------------------------------------------

export async function listarAuditoria(filtros: {
  tabla?: string;
  desde?: string;
  hasta?: string;
}): Promise<EntradaAuditoriaConUsuario[]> {
  let query = supabase
    .from('bitacora_auditoria')
    .select('*, usuario:id_usuario(nombres, apellidos)')
    .order('fecha_hora', { ascending: false })
    .limit(200);

  if (filtros.tabla) query = query.eq('tabla', filtros.tabla);
  if (filtros.desde) query = query.gte('fecha_hora', filtros.desde);
  if (filtros.hasta) query = query.lte('fecha_hora', filtros.hasta);

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as EntradaAuditoriaConUsuario[];
}

export const ROLES_DISPONIBLES: RolCodigo[] = ['recepcionista', 'veterinario', 'administrador'];
