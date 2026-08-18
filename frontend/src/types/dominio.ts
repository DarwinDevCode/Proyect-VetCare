// Tipos alineados con supabase/migrations (ver CLAUDE.md seccion 6).

export type RolCodigo = 'recepcionista' | 'veterinario' | 'administrador';

export interface Usuario {
  id_usuario: string;
  id_rol: number;
  nombres: string;
  apellidos: string;
  correo: string;
  activo: boolean;
  fecha_registro: string;
}

export interface Rol {
  id_rol: number;
  codigo: RolCodigo;
  nombre: string;
  descripcion: string | null;
}

export interface Especie {
  id_especie: number;
  nombre: string;
}

export interface Raza {
  id_raza: number;
  id_especie: number;
  nombre: string;
}

export interface Propietario {
  id_propietario: number;
  identificacion: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  telefono_alterno: string | null;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  fecha_registro: string;
}

export type Sexo = 'M' | 'H';

export interface Paciente {
  id_paciente: number;
  id_propietario: number;
  id_especie: number;
  id_raza: number | null;
  nombre: string;
  sexo: Sexo;
  fecha_nacimiento: string | null;
  color: string | null;
  activo: boolean;
  fecha_registro: string;
}

export interface PacienteConFicha extends Paciente {
  propietario: Propietario;
  especie: Especie;
  raza: Raza | null;
}

export interface Consulta {
  id_consulta: number;
  id_paciente: number;
  id_veterinario: string;
  id_cita: number | null;
  fecha_hora: string;
  motivo: string;
  // Nullables pese a que RF-016 los enumera junto a motivo/diagnostico como "los
  // cuatro elementos": el esquema fisico solo exige motivo y diagnostico.
  hallazgos: string | null;
  diagnostico: string;
  tratamiento: string | null;
  peso_kg: number | null;
}

export interface Vacunacion {
  id_vacunacion: number;
  id_paciente: number;
  id_veterinario: string;
  id_producto: number;
  id_consulta: number | null;
  fecha_aplicacion: string;
  dosis: number;
  lote: string | null;
}

export interface ExamenLaboratorio {
  id_examen: number;
  id_paciente: number;
  id_veterinario: string;
  id_consulta: number | null;
  tipo_examen: string;
  fecha_solicitud: string;
  fecha_resultado: string | null;
  resultado: string | null;
  observacion: string | null;
}

export type TipoEventoHistorial = 'consulta' | 'vacunacion' | 'examen';

// Fila de la vista v_historial_clinico (RF-020). Las columnas se reutilizan
// posicionalmente entre los tres tipos de evento (union all) -- nunca leer
// "tratamiento"/"producto_o_examen" directamente para una fila de examen, usar
// interpretarEvento() de modules/historial/eventoHistorial.ts.
export interface EventoHistorial {
  id_paciente: number;
  tipo_evento: TipoEventoHistorial;
  fecha: string;
  id_evento: number;
  resumen: string;
  diagnostico: string | null;
  tratamiento: string | null;
  producto_o_examen: string | null;
  id_veterinario: string;
}
