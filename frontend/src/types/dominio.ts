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

export interface UsuarioConRol extends Usuario {
  rol: Rol;
}

export interface ParametroSistema {
  clave: string;
  valor: string;
  descripcion: string | null;
  fecha_actualizacion: string;
  id_usuario_actualizo: string | null;
}

export type AccionAuditoria = 'insert' | 'update';

// Fila de bitacora_auditoria (modulo de Administracion). valores_anteriores es
// null en un 'insert' -- no hay un "antes" que registrar.
export interface EntradaAuditoria {
  id_bitacora: number;
  tabla: string;
  id_registro: string | null;
  accion: AccionAuditoria;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown>;
  id_usuario: string | null;
  fecha_hora: string;
}

export interface EntradaAuditoriaConUsuario extends EntradaAuditoria {
  usuario: Pick<Usuario, 'nombres' | 'apellidos'> | null;
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

// RF-034/RF-035 (Fase 2): amplia RF-011 con una lista de espera real, sin
// notificacion (sigue fuera de alcance). "Quitar" una entrada es un UPDATE a
// atendida/cancelada, nunca un DELETE (RF-033).
export type EstadoListaEspera = 'pendiente' | 'atendida' | 'cancelada';
export type FranjaPreferida = 'manana' | 'tarde';

export interface ListaEspera {
  id_lista_espera: number;
  id_paciente: number;
  id_veterinario: string | null;
  fecha_preferida: string | null;
  franja_preferida: FranjaPreferida | null;
  motivo: string;
  estado: EstadoListaEspera;
  id_usuario_registro: string;
  fecha_registro: string;
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
  // RF-041 (Fase 2): dias hasta la siguiente dosis, solo relevante para tipo
  // 'vacuna'. Nullable -- no todo el catalogo tiene un esquema de refuerzo conocido.
  intervalo_dias: number | null;
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
  // Fase 2 (version ligera de lotes, ver CLAUDE.md/REDISENO-ORGANIC-PLAN.md): solo se
  // completan en un movimiento 'ingreso'; no participan de fn_actualizar_existencia.
  lote_codigo: string | null;
  fecha_vencimiento: string | null;
}

// Fila de v_lotes_por_vencer (Fase 2): ingresos con vencimiento en los proximos 30
// dias. Se deriva siempre de current_date, nunca se almacena como estado.
export interface LotePorVencer {
  id_movimiento: number;
  id_producto: number;
  producto: string;
  lote_codigo: string | null;
  fecha_vencimiento: string;
  cantidad: number;
  fecha_hora: string;
}

export interface MovimientoConResponsable extends MovimientoInventario {
  usuario: Pick<Usuario, 'nombres' | 'apellidos'>;
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
  // RF-040 (Fase 2): signos vitales, todos opcionales -- amplian RF-016 sin volverse
  // parte de "los cuatro elementos" obligatorios.
  temperatura_c: number | null;
  frecuencia_cardiaca_lpm: number | null;
  frecuencia_respiratoria_rpm: number | null;
}

// Fila de v_vacunas_proximas (RF-041, Fase 2): una por paciente+vacuna con
// intervalo_dias definido. proxima_fecha se calcula siempre en la base a partir de
// la ultima aplicacion, nunca en el cliente.
export interface VacunaProxima {
  id_paciente: number;
  id_producto: number;
  producto: string;
  ultima_aplicacion: string;
  intervalo_dias: number;
  proxima_fecha: string;
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
  // RF-040 (Fase 2): solo tienen valor en una fila 'consulta'; null en las demas.
  temperatura_c: number | null;
  frecuencia_cardiaca_lpm: number | null;
  frecuencia_respiratoria_rpm: number | null;
}

export type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia';

export type EstadoCobro = 'pendiente' | 'parcial' | 'pagada';

export interface Factura {
  id_factura: number;
  // Asignado siempre por fn_asignar_numero_factura (RF-029/RN-016); nunca se envia
  // desde el cliente, igual que cita.fecha_hora_fin o existencia_resultante.
  numero: string;
  id_propietario: number;
  id_consulta: number | null;
  fecha_emision: string;
  subtotal: number;
  impuesto: number;
  // Columna generada (subtotal + impuesto).
  total: number;
  id_usuario_emisor: string;
}

export interface DetalleFactura {
  id_detalle: number;
  id_factura: number;
  numero_linea: number;
  id_producto: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  // Columna generada (cantidad * precio_unitario).
  subtotal_linea: number;
}

export interface Pago {
  id_pago: number;
  id_factura: number;
  fecha_pago: string;
  monto: number;
  forma_pago: FormaPago;
  referencia: string | null;
  id_usuario: string;
}

// Fila de la vista v_estado_factura (RF-031). estado_cobro y saldo_pendiente los
// deriva la base comparando total con la suma de pagos (RN-015): nunca se calculan
// en el cliente, para que no puedan divergir de lo que dice la base.
export interface EstadoFactura {
  id_factura: number;
  numero: string;
  id_propietario: number;
  id_consulta: number | null;
  fecha_emision: string;
  id_usuario_emisor: string;
  subtotal: number;
  impuesto: number;
  total: number;
  total_pagado: number;
  saldo_pendiente: number;
  estado_cobro: EstadoCobro;
}

export interface FacturaListada extends EstadoFactura {
  propietario: Pick<Propietario, 'identificacion' | 'nombres' | 'apellidos'>;
}

// Un concepto a facturar tal como lo devuelve fn_conceptos_facturables (RF-028) o
// como lo escribe el usuario para un servicio suelto.
export interface ConceptoFacturable {
  id_producto: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

// RF-036 a RF-039 (Fase 4, Módulo 7 nuevo): Compras y Proveedores. Amplía
// deliberadamente la exclusión de "Compras, órdenes de compra y gestión de
// proveedores" del SRS -- ver CLAUDE.md sección 14.
export interface Proveedor {
  id_proveedor: number;
  nombre: string;
  identificacion: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  fecha_registro: string;
}

// RN-022: 'recibida' dispara el ingreso automático de inventario, una sola vez
// (fn_recibir_orden_compra, con guarda old.estado is distinct from 'recibida').
export type EstadoOrdenCompra = 'borrador' | 'emitida' | 'recibida' | 'cancelada';

export interface OrdenCompra {
  id_orden_compra: number;
  id_proveedor: number;
  estado: EstadoOrdenCompra;
  observacion: string | null;
  id_usuario_registro: string;
  fecha_registro: string;
}

export interface DetalleOrdenCompra {
  id_detalle: number;
  id_orden_compra: number;
  numero_linea: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  // Columna generada (cantidad * precio_unitario), mismo patrón que
  // detalle_factura.subtotal_linea.
  subtotal_linea: number;
}

// Una línea tal como la escribe el usuario para fn_crear_orden_compra (RF-037):
// atómica, cabecera + líneas en una sola llamada RPC.
export interface LineaOrdenCompra {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
}
