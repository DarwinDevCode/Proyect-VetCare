import dayjs, { type Dayjs } from 'dayjs';
import { supabase } from '../../lib/supabaseClient';
import type { Cita, CitaConDetalle, ListaEspera, PacienteParaCita, Rol, Usuario } from '../../types/dominio';

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

// RF-013 ("filtrando por periodo"), vista semanal (1f): mismo patron que
// listarCitasDelDia -- trae todos los veterinarios, el filtro de cual mostrar
// se aplica en la UI, no aqui.
export async function listarCitasDeLaSemana(inicioSemana: Dayjs): Promise<CitaConDetalle[]> {
  const inicio = inicioSemana.startOf('day').toISOString();
  const fin = inicioSemana.add(7, 'day').startOf('day').toISOString();

  const { data, error } = await supabase
    .from('cita')
    .select(
      `*, paciente:id_paciente(${SELECCION_PACIENTE_CITA}), veterinario:id_veterinario(id_usuario, nombres, apellidos)`,
    )
    .gte('fecha_hora_inicio', inicio)
    .lt('fecha_hora_inicio', fin)
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

// RF-043 (Fase 5): citas 'solicitada' desde el portal, pendientes de que Recepcion
// les asigne veterinario/horario real. No aparecen en AgendaGrid (agrupa por
// veterinario, y una solicitud todavia no tiene uno) -- se listan aparte.
export async function listarSolicitudesPendientes(): Promise<CitaConDetalle[]> {
  const { data, error } = await supabase
    .from('cita')
    .select(
      `*, paciente:id_paciente(${SELECCION_PACIENTE_CITA}), veterinario:id_veterinario(id_usuario, nombres, apellidos)`,
    )
    .eq('estado', 'solicitada')
    .order('fecha_registro');
  if (error) throw error;
  return data as unknown as CitaConDetalle[];
}

// RF-043: confirmar una solicitud -- asigna veterinario y horario real, pasando de
// 'solicitada' a 'programada'. Este UPDATE es el que activa el EXCLUDE de
// solapamiento (RN-004) para esta cita: si el horario ya esta ocupado, falla con
// 23P01 igual que crearCita/reprogramarCita.
export async function confirmarSolicitud(
  id: number,
  datos: Pick<Cita, 'fecha_hora_inicio' | 'duracion_minutos'> & { id_veterinario: string },
): Promise<Cita> {
  const { data, error } = await supabase
    .from('cita')
    .update({ ...datos, estado: 'programada' })
    .eq('id_cita', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Resumen de citas de un paciente, para la pestana "Citas" de la ficha
// (Modulo 1). Mismo nivel de acceso que el resto de Agenda: cita_select ya
// admite tanto a Recepcionista como a Veterinario, los dos roles que abren
// PacientesPage -- no hace falta una politica RLS nueva.
export interface CitaResumen {
  id_cita: number;
  fecha_hora_inicio: string;
  motivo: string | null;
  estado: Cita['estado'];
  veterinario: Pick<Usuario, 'nombres' | 'apellidos'>;
}

export async function listarCitasPorPaciente(idPaciente: number): Promise<CitaResumen[]> {
  const { data, error } = await supabase
    .from('cita')
    .select('id_cita, fecha_hora_inicio, motivo, estado, veterinario:id_veterinario(nombres, apellidos)')
    .eq('id_paciente', idPaciente)
    .order('fecha_hora_inicio', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as unknown as CitaResumen[];
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

// ----------------------------------------------------------------------------
// RF-034/RF-035 (Fase 2): lista de espera. Mismo patron de acceso que el resto de
// Agenda -- Recepcionista gestiona, Veterinario solo consulta (RLS en
// lista_espera.sql).
// ----------------------------------------------------------------------------

export interface ListaEsperaConPaciente extends ListaEspera {
  paciente: PacienteParaCita;
  veterinario: Pick<Usuario, 'id_usuario' | 'nombres' | 'apellidos'> | null;
}

const SELECCION_LISTA_ESPERA = `*, paciente:id_paciente(${SELECCION_PACIENTE_CITA}), veterinario:id_veterinario(id_usuario, nombres, apellidos)`;

// RF-034: listado completo, mas antigua primero (orden de llegada -- FIFO, la
// misma logica implicita que ya usa "sugerencias" de disponibilidad).
export async function listarListaEspera(): Promise<ListaEsperaConPaciente[]> {
  const { data, error } = await supabase
    .from('lista_espera')
    .select(SELECCION_LISTA_ESPERA)
    .order('fecha_registro');
  if (error) throw error;
  return data as unknown as ListaEsperaConPaciente[];
}

export async function crearListaEspera(
  datos: Pick<ListaEspera, 'id_paciente' | 'motivo'> &
    Partial<Pick<ListaEspera, 'id_veterinario' | 'fecha_preferida' | 'franja_preferida'>>,
): Promise<ListaEspera> {
  const { data, error } = await supabase.from('lista_espera').insert(datos).select().single();
  if (error) throw error;
  return data;
}

export async function cancelarListaEspera(id: number): Promise<ListaEspera> {
  const { data, error } = await supabase
    .from('lista_espera')
    .update({ estado: 'cancelada' })
    .eq('id_lista_espera', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// RF-015 wiring (1i): al cancelar una cita, se marca la entrada de lista de espera
// que se agendo con ese cupo -- distinto de "cancelada" (el propietario ya no
// espera nada), significa que se le dio el lugar liberado.
export async function marcarAtendidaListaEspera(id: number): Promise<ListaEspera> {
  const { data, error } = await supabase
    .from('lista_espera')
    .update({ estado: 'atendida' })
    .eq('id_lista_espera', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// RF-015 wiring (1i): coincidencias para el cupo que se acaba de liberar al
// cancelar una cita. "id_veterinario is null" significa "cualquier veterinario",
// asi que tambien coincide. No se filtra por fecha_preferida aqui -- es una
// preferencia, no un requisito estricto, y limitar de mas dejaria coincidencias
// reales sin mostrar (ej. alguien que pidio "lo antes posible", sin fecha).
export async function listarCoincidenciasListaEspera(idVeterinario: string): Promise<ListaEsperaConPaciente[]> {
  const { data, error } = await supabase
    .from('lista_espera')
    .select(SELECCION_LISTA_ESPERA)
    .eq('estado', 'pendiente')
    .or(`id_veterinario.eq.${idVeterinario},id_veterinario.is.null`)
    .order('fecha_registro');
  if (error) throw error;
  return data as unknown as ListaEsperaConPaciente[];
}
