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

export type EstadoCita = 'programada' | 'cancelada' | 'atendida';

export interface Cita {
  id_cita: number;
  id_paciente: number;
  id_veterinario: string;
  fecha_hora_inicio: string;
  // Materializada por trigger (fn_calcular_fin_cita) al insertar/actualizar: nunca se
  // envia desde el cliente, siempre se lee tal cual la devuelve la base.
  fecha_hora_fin: string;
  duracion_minutos: number;
  motivo: string | null;
  estado: EstadoCita;
  id_usuario_registro: string | null;
  fecha_registro: string;
}

export interface PacienteParaCita {
  id_paciente: number;
  nombre: string;
  sexo: Sexo;
  propietario: Pick<Propietario, 'nombres' | 'apellidos' | 'telefono'>;
}

export interface CitaConDetalle extends Cita {
  paciente: PacienteParaCita;
  veterinario: Pick<Usuario, 'id_usuario' | 'nombres' | 'apellidos'>;
}

export type TipoProducto = 'medicamento' | 'insumo' | 'vacuna';

export interface Producto {
  id_producto: number;
  codigo: string;
  nombre: string;
  tipo: TipoProducto;
  presentacion: string | null;
  unidad_medida: string;
  nivel_minimo: number;
  // Mantenida siempre por fn_actualizar_existencia (trigger sobre movimiento_inventario);
  // nunca es un campo de formulario, ni al crear ni al editar.
  existencia_actual: number;
  precio_unitario: number;
  activo: boolean;
}

export type TipoMovimiento = 'ingreso' | 'ajuste' | 'consumo';

export interface MovimientoInventario {
  id_movimiento: number;
  id_producto: number;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  // Calculada siempre por fn_actualizar_existencia; nunca se envia desde el cliente.
  existencia_resultante: number;
  fecha_hora: string;
  id_usuario: string;
  id_consulta: number | null;
  id_vacunacion: number | null;
  observacion: string | null;
}

export interface MovimientoConResponsable extends MovimientoInventario {
  usuario: Pick<Usuario, 'nombres' | 'apellidos'>;
}
