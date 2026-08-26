import { supabase } from '../../lib/supabaseClient';
import type { DetalleOrdenCompra, EstadoOrdenCompra, LineaOrdenCompra, OrdenCompra, Proveedor } from '../../types/dominio';

// RF-036: catálogo de proveedores (activos e inactivos, para poder reactivar --
// mismo criterio que listarProductos en Módulo 4).
export async function listarProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase.from('proveedor').select('*').order('nombre').limit(500);
  if (error) throw error;
  return data;
}

export async function crearProveedor(
  datos: Omit<Proveedor, 'id_proveedor' | 'activo' | 'fecha_registro'>,
): Promise<Proveedor> {
  const { data, error } = await supabase.from('proveedor').insert(datos).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarProveedor(
  id: number,
  datos: Partial<Omit<Proveedor, 'id_proveedor' | 'fecha_registro'>>,
): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedor')
    .update(datos)
    .eq('id_proveedor', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface OrdenCompraConProveedor extends OrdenCompra {
  proveedor: Pick<Proveedor, 'nombre'>;
}

// RF-037/038/039: listado completo, más reciente primero.
export async function listarOrdenesCompra(): Promise<OrdenCompraConProveedor[]> {
  const { data, error } = await supabase
    .from('orden_compra')
    .select('*, proveedor:id_proveedor(nombre)')
    .order('fecha_registro', { ascending: false });
  if (error) throw error;
  return data as unknown as OrdenCompraConProveedor[];
}

export interface DetalleOrdenCompraConProducto extends DetalleOrdenCompra {
  producto: { nombre: string; unidad_medida: string };
}

export async function listarDetalleOrdenCompra(idOrdenCompra: number): Promise<DetalleOrdenCompraConProducto[]> {
  const { data, error } = await supabase
    .from('detalle_orden_compra')
    .select('*, producto:id_producto(nombre, unidad_medida)')
    .eq('id_orden_compra', idOrdenCompra)
    .order('numero_linea');
  if (error) throw error;
  return data as unknown as DetalleOrdenCompraConProducto[];
}

// RF-037: cabecera + líneas en una sola llamada RPC transaccional -- PostgREST no
// da transacciones entre peticiones y una orden sin todas sus líneas no debe poder
// quedar registrada (mismo motivo que fn_emitir_factura, ver CLAUDE.md sección 6).
export async function crearOrdenCompra(
  idProveedor: number,
  observacion: string | null,
  lineas: LineaOrdenCompra[],
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_crear_orden_compra', {
    p_id_proveedor: idProveedor,
    p_observacion: observacion,
    p_lineas: lineas,
  });
  if (error) throw error;
  return data as number;
}

// RF-038/RF-039: transiciones de estado. 'recibida' es la única que dispara efectos
// (fn_recibir_orden_compra, RN-022) -- este cliente solo cambia el estado, nunca
// toca movimiento_inventario directamente.
export async function actualizarEstadoOrdenCompra(id: number, estado: EstadoOrdenCompra): Promise<OrdenCompra> {
  const { data, error } = await supabase
    .from('orden_compra')
    .update({ estado })
    .eq('id_orden_compra', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
