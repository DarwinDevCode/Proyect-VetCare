import { supabase } from '../../lib/supabaseClient';
import type { MovimientoConResponsable, MovimientoInventario, Producto } from '../../types/dominio';

// RF-025: catalogo completo (activos e inactivos, para que Administrador pueda
// reactivar). Sin filtro de texto: a diferencia de paciente/propietario, el catalogo
// de producto es acotado y no cruza tablas para buscar, asi que se filtra en memoria
// en InventarioPage en vez de hacer un ilike contra el servidor en cada tecleo.
export async function listarProductos(): Promise<Producto[]> {
  const { data, error } = await supabase.from('producto').select('*').order('nombre').limit(500);
  if (error) throw error;
  return data;
}

// RF-021. No se envia existencia_actual: la mantiene siempre fn_actualizar_existencia
// a partir de movimientos, nunca un valor inicial arbitrario del formulario.
export async function crearProducto(
  datos: Omit<Producto, 'id_producto' | 'activo' | 'existencia_actual'>,
): Promise<Producto> {
  const { data, error } = await supabase.from('producto').insert(datos).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarProducto(
  id: number,
  datos: Partial<Omit<Producto, 'id_producto' | 'existencia_actual'>>,
): Promise<Producto> {
  const { data, error } = await supabase
    .from('producto')
    .update(datos)
    .eq('id_producto', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// RF-027: bitacora del producto, mas reciente primero.
export async function listarMovimientos(idProducto: number): Promise<MovimientoConResponsable[]> {
  const { data, error } = await supabase
    .from('movimiento_inventario')
    .select('*, usuario:id_usuario(nombres, apellidos)')
    .eq('id_producto', idProducto)
    .order('fecha_hora', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as unknown as MovimientoConResponsable[];
}

// RF-022 (ingreso/ajuste, exclusivo de Administrador) y RF-023 (consumo, exclusivo de
// Veterinario): una sola funcion, porque la RLS ya distingue por tipo_movimiento y no
// hace falta un segundo camino en el cliente. id_consulta/id_vacunacion son opcionales
// porque chk_movimiento_origen solo los exige --y solo uno de los dos-- cuando el
// movimiento es un consumo (RN-009). Nunca se envia existencia_resultante: la calcula
// fn_actualizar_existencia.
export async function registrarMovimiento(
  datos: Pick<MovimientoInventario, 'id_producto' | 'tipo_movimiento' | 'cantidad' | 'observacion'> &
    Partial<Pick<MovimientoInventario, 'id_consulta' | 'id_vacunacion'>>,
): Promise<MovimientoInventario> {
  const { data, error } = await supabase.from('movimiento_inventario').insert(datos).select().single();
  if (error) throw error;
  return data;
}
