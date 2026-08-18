import dayjs from 'dayjs';
import { supabase } from '../../lib/supabaseClient';
import type { Cita, CitaConDetalle, PacienteParaCita, Rol, Usuario } from '../../types/dominio';

const SELECCION_PACIENTE_CITA =
  'id_paciente, nombre, sexo, propietario:id_propietario(nombres, apellidos, telefono)';

export async function listarVeterinarios(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuario')
    .select('*, rol:id_rol!inner(*)')
    .eq('rol.codigo', 'veterinario')
    .eq('activo', true)
    .order('nombres');
  if (error) throw error;

  return (data as unknown as (Usuario & { rol: Rol })[]).map(({ rol: _rol, ...usuario }) => usuario);
}

// RF-013: consultar agenda por periodo (aqui, un dia) y por veterinario. El filtro por
// veterinario se aplica en la UI sobre este resultado (columnas visibles del grid), no
// aqui, para no repetir la consulta al cambiar la seleccion.
export async function listarCitasDelDia(fecha: string): Promise<CitaConDetalle[]> {
  const inicioDia = dayjs(fecha).startOf('day').toISOString();
  const inicioDiaSiguiente = dayjs(fecha).add(1, 'day').startOf('day').toISOString();

  const { data, error } = await supabase
    .from('cita')
    .select(
      `*, paciente:id_paciente(${SELECCION_PACIENTE_CITA}), veterinario:id_veterinario(id_usuario, nombres, apellidos)`,
    )
    .gte('fecha_hora_inicio', inicioDia)
    .lt('fecha_hora_inicio', inicioDiaSiguiente)
    .order('fecha_hora_inicio');

  if (error) throw error;
  return data as unknown as CitaConDetalle[];
}

// RF-012: seleccionar un paciente ya registrado (Modulo 1) para agendarle una cita.
// Mismo patron de doble consulta + merge que buscarFichas (modules/pacientes/api.ts):
// el "!inner" es obligatorio para filtrar por datos del propietario embebido, ver
// CLAUDE.md seccion 6.
export async function buscarPacientesActivos(texto: string): Promise<PacienteParaCita[]> {
  let query = supabase.from('paciente').select(SELECCION_PACIENTE_CITA).eq('activo', true).order('nombre');
  if (texto.trim()) {
    query = query.or(`nombre.ilike.%${texto}%`);
  }
  const { data, error } = await query.limit(20);
  if (error) throw error;

  let resultados = data as unknown as PacienteParaCita[];

  if (texto.trim()) {
    const { data: porPropietario, error: errorProp } = await supabase
      .from('paciente')
      .select(
        `id_paciente, nombre, sexo, propietario:id_propietario!inner(nombres, apellidos, telefono)`,
      )
      .eq('activo', true)
      .or(`nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%`, { foreignTable: 'propietario' })
      .limit(20);
    if (errorProp) throw errorProp;

    const combinados = new Map<number, PacienteParaCita>();
    for (const p of [...resultados, ...((porPropietario ?? []) as unknown as PacienteParaCita[])]) {
      combinados.set(p.id_paciente, p);
    }
    resultados = Array.from(combinados.values());
  }

  return resultados;
}

// RF-012. No se envia fecha_hora_fin: la calcula siempre fn_calcular_fin_cita en la
// base (ver CLAUDE.md / plan del modulo), y el EXCLUDE de solapamiento (RN-004) es
// quien realmente garantiza la disponibilidad verificada por RF-011.
export async function crearCita(
  datos: Pick<Cita, 'id_paciente' | 'id_veterinario' | 'fecha_hora_inicio' | 'duracion_minutos' | 'motivo'>,
): Promise<Cita> {
  const { data, error } = await supabase.from('cita').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// RF-014: solo fecha/hora/duracion -- reasignar veterinario no es parte de este RF.
export async function reprogramarCita(
  id: number,
  datos: Pick<Cita, 'fecha_hora_inicio' | 'duracion_minutos'>,
): Promise<Cita> {
  const { data, error } = await supabase
    .from('cita')
    .update(datos)
    .eq('id_cita', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// RF-015/RN-005: cambia de estado, nunca se borra.
export async function cancelarCita(id: number): Promise<Cita> {
  const { data, error } = await supabase
    .from('cita')
    .update({ estado: 'cancelada' })
    .eq('id_cita', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
