import { supabase } from '../../lib/supabaseClient';
import type { Especie, Paciente, PacienteConFicha, Propietario, Raza } from '../../types/dominio';

export async function listarEspecies(): Promise<Especie[]> {
  const { data, error } = await supabase.from('especie').select('*').order('nombre');
  if (error) throw error;
  return data;
}

export async function listarRazasPorEspecie(idEspecie: number): Promise<Raza[]> {
  const { data, error } = await supabase
    .from('raza')
    .select('*')
    .eq('id_especie', idEspecie)
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function buscarPropietarios(texto: string): Promise<Propietario[]> {
  let query = supabase.from('propietario').select('*').eq('activo', true).order('apellidos');
  if (texto.trim()) {
    query = query.or(
      `identificacion.ilike.%${texto}%,nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%`,
    );
  }
  const { data, error } = await query.limit(20);
  if (error) throw error;
  return data;
}

// RF-007: localizar ficha (paciente + propietario) por criterios de busqueda.
export async function buscarFichas(texto: string): Promise<PacienteConFicha[]> {
  let query = supabase
    .from('paciente')
    // paciente.id_raza participa en una FK compuesta (id_raza, id_especie) -> raza,
    // por eso PostgREST necesita el nombre de la restriccion para desambiguar el
    // embed (ver CLAUDE.md / migracion de esquema, seccion "paciente").
    .select('*, propietario:id_propietario(*), especie:id_especie(*), raza:raza!paciente_id_raza_id_especie_fkey(*)')
    .eq('activo', true)
    .order('nombre');

  if (texto.trim()) {
    query = query.or(`nombre.ilike.%${texto}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  let resultados = data as unknown as PacienteConFicha[];

  if (texto.trim()) {
    const { data: porPropietario, error: errorProp } = await supabase
      .from('paciente')
      .select('*, propietario:id_propietario(*), especie:id_especie(*), raza:raza!paciente_id_raza_id_especie_fkey(*)')
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

export async function crearPropietario(
  datos: Omit<Propietario, 'id_propietario' | 'activo' | 'fecha_registro'>,
): Promise<Propietario> {
  const { data, error } = await supabase.from('propietario').insert(datos).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarPropietario(
  id: number,
  datos: Partial<Omit<Propietario, 'id_propietario' | 'fecha_registro'>>,
): Promise<Propietario> {
  const { data, error } = await supabase
    .from('propietario')
    .update(datos)
    .eq('id_propietario', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function crearPaciente(
  datos: Omit<Paciente, 'id_paciente' | 'activo' | 'fecha_registro'>,
): Promise<Paciente> {
  const { data, error } = await supabase.from('paciente').insert(datos).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarPaciente(
  id: number,
  datos: Partial<Omit<Paciente, 'id_paciente' | 'id_propietario' | 'fecha_registro'>>,
): Promise<Paciente> {
  const { data, error } = await supabase
    .from('paciente')
    .update(datos)
    .eq('id_paciente', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
