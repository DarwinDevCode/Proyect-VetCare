import { supabase } from '../../lib/supabaseClient';
import type {
  ConceptoFacturable,
  DetalleFactura,
  EstadoCobro,
  FacturaListada,
  Pago,
} from '../../types/dominio';
import { PORCENTAJE_IMPUESTO_POR_DEFECTO } from './formato';

// Modulo de Administracion (AD-15) permite editar este valor sin tocar
// codigo; se lee en vivo aqui en vez de confiar solo en la constante, que
// queda como respaldo si el parametro no estuviera cargado todavia.
export async function obtenerPorcentajeImpuestoActual(): Promise<number> {
  const { data, error } = await supabase
    .from('parametro_sistema')
    .select('valor')
    .eq('clave', 'impuesto_defecto_pct')
    .maybeSingle();
  if (error || !data) return PORCENTAJE_IMPUESTO_POR_DEFECTO;
  const numero = Number(data.valor);
  return Number.isFinite(numero) ? numero : PORCENTAJE_IMPUESTO_POR_DEFECTO;
}

// Una atencion que todavia puede facturarse, tal como la devuelve
// fn_atenciones_facturables. No trae ningun dato clinico a proposito: Recepcion
// identifica la atencion por mascota, propietario y fecha (ver la migracion).
export interface AtencionFacturable {
  id_consulta: number;
  fecha_hora: string;
  id_propietario: number;
  paciente: string;
  propietario_nombres: string;
  propietario_apellidos: string;
  propietario_identificacion: string;
}

export interface FiltrosFactura {
  desde: string | null;
  hasta: string | null;
  propietario: string;
  estadoCobro: EstadoCobro | '';
}

// RF-031: facturas emitidas, filtrando por periodo, propietario y situacion de
// cobro. estado_cobro y saldo_pendiente vienen de v_estado_factura, nunca se
// calculan aqui: RN-015 vive en la base para que no pueda divergir.
export async function listarFacturas(filtros: FiltrosFactura): Promise<FacturaListada[]> {
  let query = supabase
    .from('v_estado_factura')
    .select('*, propietario:id_propietario!inner(identificacion, nombres, apellidos)')
    .order('fecha_emision', { ascending: false });

  if (filtros.desde) query = query.gte('fecha_emision', filtros.desde);
  // El limite superior es exclusivo del dia siguiente: fecha_emision es timestamptz,
  // asi que un lte contra "2026-08-19" dejaria fuera todo lo emitido ese mismo dia
  // despues de la medianoche -- es decir, practicamente todo.
  if (filtros.hasta) query = query.lt('fecha_emision', `${filtros.hasta}T23:59:59.999`);
  if (filtros.estadoCobro) query = query.eq('estado_cobro', filtros.estadoCobro);
  if (filtros.propietario.trim()) {
    // Filtro sobre una tabla embebida: obliga a "!inner" o PostgREST devolveria el
    // padre con el embed en null en vez de descartarlo (ver CLAUDE.md seccion 6).
    query = query.or(
      `identificacion.ilike.%${filtros.propietario}%,nombres.ilike.%${filtros.propietario}%,apellidos.ilike.%${filtros.propietario}%`,
      { foreignTable: 'propietario' },
    );
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data as unknown as FacturaListada[];
}

// RF-031: el detalle de una factura (los conceptos cobrados).
export async function listarDetalle(idFactura: number): Promise<DetalleFactura[]> {
  const { data, error } = await supabase
    .from('detalle_factura')
    .select('*')
    .eq('id_factura', idFactura)
    .order('numero_linea');
  if (error) throw error;
  return data;
}

// RF-030/RN-015: los pagos recibidos sobre una factura.
export async function listarPagos(idFactura: number): Promise<Pago[]> {
  const { data, error } = await supabase
    .from('pago')
    .select('*')
    .eq('id_factura', idFactura)
    .order('fecha_pago');
  if (error) throw error;
  return data;
}

// RF-028: atenciones registradas que todavia no se han facturado.
export async function listarAtencionesFacturables(): Promise<AtencionFacturable[]> {
  const { data, error } = await supabase.rpc('fn_atenciones_facturables');
  if (error) throw error;
  return data as AtencionFacturable[];
}

// RF-028: los conceptos que se recuperan de una atencion. Se muestran antes de
// emitir para que Recepcion vea que se va a cobrar, pero los precios definitivos
// los vuelve a resolver el servidor al emitir (RN-014) -- lo que se muestra aqui es
// informativo, no lo que se envia.
export async function obtenerConceptosDeAtencion(idConsulta: number): Promise<ConceptoFacturable[]> {
  const { data, error } = await supabase.rpc('fn_conceptos_facturables', { p_id_consulta: idConsulta });
  if (error) throw error;
  return data as ConceptoFacturable[];
}

interface DatosEmision {
  idPropietario: number | null;
  idConsulta: number | null;
  porcentajeImpuesto: number;
  // null => el servidor recupera los conceptos de la atencion (RF-028).
  lineas: ConceptoFacturable[] | null;
}

// RF-028/RF-029: emision completa en una sola llamada. No se insertan cabecera y
// lineas por separado desde aqui: PostgREST no da transacciones entre peticiones y
// RES-07/RNF-005 exigen que la factura se complete entera o no exista (ver la
// migracion de facturacion y CLAUDE.md seccion 6).
export async function emitirFactura(datos: DatosEmision): Promise<number> {
  const { data, error } = await supabase.rpc('fn_emitir_factura', {
    p_id_propietario: datos.idPropietario,
    p_id_consulta: datos.idConsulta,
    p_porcentaje_impuesto: datos.porcentajeImpuesto,
    p_lineas: datos.lineas,
  });
  if (error) throw error;
  return data as number;
}

// RF-030. No se envia id_usuario: lo completa auth.uid() por defecto (RF-003),
// igual que en consulta o movimiento_inventario.
export async function registrarPago(
  datos: Pick<Pago, 'id_factura' | 'monto' | 'forma_pago' | 'referencia'>,
): Promise<Pago> {
  const { data, error } = await supabase.from('pago').insert(datos).select().single();
  if (error) throw error;
  return data;
}

// RF-030 (1r, "pago mixto"): una factura se cobra con varias formas de pago en una
// sola accion (ej. parte efectivo, parte tarjeta). RN-015 ya admite varios `pago`
// por factura -- esto no es una regla nueva, es solo la UI insertando varias filas
// a la vez en vez de una por vez. El array se manda en un unico INSERT de
// PostgREST (una sola sentencia SQL con varios VALUES), no N llamadas
// secuenciales: si una linea fuera invalida, la operacion entera se revierte, en
// vez de dejar cobrado el efectivo pero no la tarjeta.
export async function registrarPagosMixtos(
  lineas: Pick<Pago, 'id_factura' | 'monto' | 'forma_pago' | 'referencia'>[],
): Promise<Pago[]> {
  const { data, error } = await supabase.from('pago').insert(lineas).select();
  if (error) throw error;
  return data;
}

export interface PagoDeReporte extends Pago {
  factura: { numero: string; id_propietario: number };
}

// RF-032: ingresos de un rango de fechas. "Ingreso" es dinero efectivamente
// cobrado (pago), no facturado: una factura emitida y no cobrada todavia no es un
// ingreso, y RN-015 admite que una factura se cobre en varios pagos, incluso en
// fechas distintas a la de emision. La consolidacion (totales y desglose por forma
// de pago) se hace en memoria sobre estas filas, no con una funcion aparte: es una
// suma sobre datos que el rol ya puede leer, no una regla de negocio que deba
// vivir en la base.
export async function listarPagosDelPeriodo(desde: string, hasta: string): Promise<PagoDeReporte[]> {
  const { data, error } = await supabase
    .from('pago')
    .select('*, factura:id_factura(numero, id_propietario)')
    .gte('fecha_pago', desde)
    .lt('fecha_pago', `${hasta}T23:59:59.999`)
    .order('fecha_pago');
  if (error) throw error;
  return data as unknown as PagoDeReporte[];
}
