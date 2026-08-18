import { supabase } from '../../lib/supabaseClient';
import type {
  Consulta,
  EventoHistorial,
  ExamenLaboratorio,
  PacienteConFicha,
  Vacunacion,
} from '../../types/dominio';

// Tipos locales y angostos, deliberadamente NO agregados a types/dominio.ts: los
// tipos completos de Cita y Producto ya los definen las ramas modulo-2-agenda-citas y
// modulo-4-inventario en ese mismo archivo, y agregarlos aqui tambien produciria
// definiciones duplicadas al fusionar. Solo se necesitan estos campos para los
// selectores de "vincular con la cita" (RF-017) y "elegir la vacuna" (RF-018).
interface CitaVinculable {
  id_cita: number;
  fecha_hora_inicio: string;
  motivo: string | null;
  estado: string;
}

export interface ProductoVacuna {
  id_producto: number;
  nombre: string;
}

// RF-007 (Modulo 1) reutilizado aqui con el mismo patron que buscarFichas: doble
// consulta + merge, porque "!inner" es obligatorio para filtrar por datos del
// propietario embebido (ver CLAUDE.md seccion 6).
export async function buscarPacientesActivos(texto: string): Promise<PacienteConFicha[]> {
  const seleccion = '*, propietario:id_propietario(*), especie:id_especie(*), raza:raza!paciente_id_raza_id_especie_fkey(*)';

  let query = supabase.from('paciente').select(seleccion).eq('activo', true).order('nombre');
  if (texto.trim()) {
    query = query.or(`nombre.ilike.%${texto}%`);
  }
  const { data, error } = await query.limit(50);
  if (error) throw error;

  let resultados = data as unknown as PacienteConFicha[];

  if (texto.trim()) {
    const { data: porPropietario, error: errorProp } = await supabase
      .from('paciente')
      .select(`*, propietario:id_propietario!inner(*), especie:id_especie(*), raza:raza!paciente_id_raza_id_especie_fkey(*)`)
      .eq('activo', true)
      .or(
        `identificacion.ilike.%${texto}%,nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%`,
        { foreignTable: 'propietario' },
      )
      .limit(50);
    if (errorProp) throw errorProp;

    const combinados = new Map<number, PacienteConFicha>();
    for (const p of [...resultados, ...((porPropietario ?? []) as unknown as PacienteConFicha[])]) {
      combinados.set(p.id_paciente, p);
    }
    resultados = Array.from(combinados.values());
  }

  return resultados;
}

// RF-020: historial unico y cronologico. Mas reciente primero (mismo criterio que
// listarMovimientos de Modulo 4).
export async function listarHistorial(idPaciente: number): Promise<EventoHistorial[]> {
  const { data, error } = await supabase
    .from('v_historial_clinico')
    .select('*')
    .eq('id_paciente', idPaciente)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data as unknown as EventoHistorial[];
}

// RF-017: citas del paciente que todavia pueden originar una consulta -- no
// canceladas (RN-005: una cancelada no representa una atencion real) y sin una
// consulta ya vinculada. consulta.id_cita es UNIQUE, asi que PostgREST resuelve la
// relacion inversa cita->consulta como de-uno-a-uno (objeto o null, no arreglo);
// verificado contra Supabase local antes de construir el dialogo encima.
export async function listarCitasVinculables(idPaciente: number): Promise<CitaVinculable[]> {
  const { data, error } = await supabase
    .from('cita')
    .select('id_cita, fecha_hora_inicio, motivo, estado, consulta(id_consulta)')
    .eq('id_paciente', idPaciente)
    .neq('estado', 'cancelada')
    .order('fecha_hora_inicio', { ascending: false });
  if (error) throw error;

  return (data as unknown as (CitaVinculable & { consulta: { id_consulta: number } | null })[])
    .filter((c) => !c.consulta)
    .map(({ consulta: _consulta, ...cita }) => cita);
}

// RF-018: solo productos activos clasificados como vacuna (el trigger
// fn_validar_producto_vacuna ya lo exige en la base; se filtra tambien aqui para no
// ofrecer opciones que la base rechazaria).
export async function listarProductosVacuna(): Promise<ProductoVacuna[]> {
  const { data, error } = await supabase
    .from('producto')
    .select('id_producto, nombre')
    .eq('tipo', 'vacuna')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data;
}

// RF-016: los cuatro elementos (motivo/hallazgos/diagnostico/tratamiento) se guardan
// en una sola operacion -- un unico insert ya es atomico. Nunca se envia
// id_veterinario: lo completa auth.uid() por defecto y ninguna RLS de insert exige
// que coincida, asi que jamas debe ser un campo de formulario (mismo principio que
// existencia_actual/fecha_hora_fin en otros modulos).
export async function crearConsulta(
  datos: Omit<Consulta, 'id_consulta' | 'id_veterinario' | 'fecha_hora'>,
): Promise<Consulta> {
  const { data, error } = await supabase.from('consulta').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// RF-018. El descuento de inventario lo dispara automaticamente
// fn_vacunacion_descuenta_inventario al insertar -- nunca se registra manualmente.
export async function crearVacunacion(
  datos: Omit<Vacunacion, 'id_vacunacion' | 'id_veterinario' | 'fecha_aplicacion'>,
): Promise<Vacunacion> {
  const { data, error } = await supabase.from('vacunacion').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// RF-019: se registra sin resultado; se completa despues con completarExamen.
export async function crearExamen(
  datos: Omit<ExamenLaboratorio, 'id_examen' | 'id_veterinario' | 'fecha_solicitud' | 'fecha_resultado' | 'resultado'>,
): Promise<ExamenLaboratorio> {
  const { data, error } = await supabase.from('examen_laboratorio').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// RF-019 / RN-007: unica excepcion a la inmutabilidad de los registros clinicos --
// completar el resultado no crea un registro nuevo, actualiza el existente.
export async function completarExamen(
  idExamen: number,
  datos: Pick<ExamenLaboratorio, 'resultado' | 'fecha_resultado'>,
): Promise<ExamenLaboratorio> {
  const { data, error } = await supabase
    .from('examen_laboratorio')
    .update(datos)
    .eq('id_examen', idExamen)
    .select()
    .single();
  if (error) throw error;
  return data;
}
