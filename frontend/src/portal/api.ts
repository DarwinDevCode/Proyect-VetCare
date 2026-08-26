import { supabase } from '../lib/supabaseClient';
import type {
  DetalleFactura,
  EstadoFactura,
  Especie,
  PacienteConFicha,
  Pago,
  TratamientoPortal,
  VacunaCarnetPortal,
} from '../types/dominio';

// Todas las consultas de aqui dependen enteramente de las politicas RLS
// identity-scoped de la migracion portal_propietario.sql (fn_propietario_actual())
// -- ninguna filtra por "el propietario actual" en el cliente: si la fila no es
// suya, la base ya no se la devuelve. Mismo criterio que el resto del proyecto
// ("la logica critica vive en la base, no en el cliente").

// "Olvidé mi contraseña" desde /portal/ingresar: la Edge Function nunca revela
// si el correo existe en el sistema (evita enumeracion de cuentas), asi que la
// respuesta siempre es la misma "ok" -- este cliente no necesita distinguir
// nada, solo reportar si la llamada en si fallo (red, servidor caido).
export async function solicitarRestablecerPassword(correo: string): Promise<void> {
  const { error } = await supabase.functions.invoke('portal-olvide-password', { body: { correo } });
  if (error) throw error;
}

// RF-044: mis mascotas. Mismo embed que buscarFichas (modules/pacientes/api.ts) --
// paciente.id_raza es una FK compuesta, necesita el nombre de la restriccion
// explicito (CLAUDE.md seccion 6).
export async function listarMisMascotas(): Promise<PacienteConFicha[]> {
  const { data, error } = await supabase
    .from('paciente')
    .select('*, propietario:id_propietario(*), especie:id_especie(*), raza:raza!paciente_id_raza_id_especie_fkey(*)')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data as unknown as PacienteConFicha[];
}

export async function listarEspecies(): Promise<Especie[]> {
  const { data, error } = await supabase.from('especie').select('*').order('nombre');
  if (error) throw error;
  return data;
}

// RF-044: carnet de vacunas de una mascota propia. RN-006 sigue intacto -- la vista
// nunca expone consulta ni examen_laboratorio (ver portal_propietario.sql).
export async function listarCarnetPorPaciente(idPaciente: number): Promise<VacunaCarnetPortal[]> {
  const { data, error } = await supabase
    .from('v_carnet_portal')
    .select('*')
    .eq('id_paciente', idPaciente)
    .order('fecha_aplicacion', { ascending: false });
  if (error) throw error;
  return data;
}

// Ampliacion posterior a la Fase 5, confirmada explicitamente con el cliente
// (CLAUDE.md seccion 14): tratamientos de una mascota propia, sobre
// v_tratamientos_portal -- expone solo tratamiento/motivo/fecha/peso, RN-006
// sigue intacto para diagnostico y hallazgos (la vista ni los selecciona).
export async function listarTratamientosPorPaciente(idPaciente: number): Promise<TratamientoPortal[]> {
  const { data, error } = await supabase
    .from('v_tratamientos_portal')
    .select('*')
    .eq('id_paciente', idPaciente)
    .order('fecha_hora', { ascending: false });
  if (error) throw error;
  return data;
}

export interface CitaPortal {
  id_cita: number;
  id_paciente: number;
  fecha_hora_inicio: string;
  duracion_minutos: number;
  motivo: string | null;
  estado: string;
  paciente: { nombre: string };
  veterinario: { nombres: string; apellidos: string } | null;
}

// RF-043: mis citas -- incluye 'solicitada' (pendientes de confirmar) igual que
// las ya confirmadas/atendidas/canceladas.
export async function listarMisCitas(): Promise<CitaPortal[]> {
  const { data, error } = await supabase
    .from('cita')
    .select('*, paciente:id_paciente(nombre), veterinario:id_veterinario(nombres, apellidos)')
    .order('fecha_hora_inicio', { ascending: false });
  if (error) throw error;
  return data as unknown as CitaPortal[];
}

// RF-043/RN-021: "solicitar" una cita, no agendarla -- sin veterinario ni horario
// real, eso lo confirma Recepcion despues (CitaDetalleDialog.tsx). estado e
// id_veterinario van literales, no confiando en ningun default: cita_insert_portal
// (RLS) los exige exactamente asi. id_usuario_registro tambien va explicito en
// null: su default es auth.uid(), pero una cuenta de portal no tiene fila en
// public.usuario, asi que el default rompe la FK -- se detecto probando el insert
// por curl antes de escribir este cliente (ver CLAUDE.md seccion 14, Fase 5).
export async function crearSolicitudCita(datos: {
  id_paciente: number;
  motivo: string;
  fecha_preferida: string | null;
}): Promise<void> {
  const { error } = await supabase.from('cita').insert({
    id_paciente: datos.id_paciente,
    motivo: datos.motivo,
    fecha_hora_inicio: datos.fecha_preferida ? `${datos.fecha_preferida}T12:00:00` : new Date().toISOString(),
    estado: 'solicitada',
    id_veterinario: null,
    id_usuario_registro: null,
  });
  if (error) throw error;
}

// Cancelar una cita propia -- fn_cancelar_cita_portal (SECURITY DEFINER) hace la
// verificacion de dueño/estado ella misma y solo toca la columna estado; no hay
// politica RLS UPDATE para el portal sobre cita a proposito (ver CLAUDE.md
// seccion 14: un WITH CHECK no puede impedir que el mismo PATCH cambie ademas
// otras columnas).
export async function cancelarMiCita(idCita: number): Promise<void> {
  const { error } = await supabase.rpc('fn_cancelar_cita_portal', { p_id_cita: idCita });
  if (error) throw error;
}

// RF-045: mis facturas, sobre la misma vista que ya usa Facturacion (RF-031) --
// security_invoker=on, asi que factura_select_portal ya la filtra sin cambios.
export async function listarMisFacturas(): Promise<EstadoFactura[]> {
  const { data, error } = await supabase
    .from('v_estado_factura')
    .select('*')
    .order('fecha_emision', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listarDetalleFactura(idFactura: number): Promise<DetalleFactura[]> {
  const { data, error } = await supabase
    .from('detalle_factura')
    .select('*')
    .eq('id_factura', idFactura)
    .order('numero_linea');
  if (error) throw error;
  return data;
}

export async function listarPagosFactura(idFactura: number): Promise<Pago[]> {
  const { data, error } = await supabase
    .from('pago')
    .select('*')
    .eq('id_factura', idFactura)
    .order('fecha_pago');
  if (error) throw error;
  return data;
}
