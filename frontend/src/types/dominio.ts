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
