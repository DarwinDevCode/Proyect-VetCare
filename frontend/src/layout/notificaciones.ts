import dayjs from 'dayjs';
import { listarListaEspera, listarSolicitudesPendientes } from '../modules/agenda/api';
import { listarLotesPorVencer, listarProductos } from '../modules/inventario/api';

export interface Notificacion {
  id: string;
  texto: string;
  detalle: string;
  ruta: string;
}

// La campana no lleva un estado de "leída" propio (sin tabla nueva, sin
// distinguir leídas/no leídas -- pedido explícito del usuario): cada apertura
// recalcula la lista de alertas vigentes a partir de datos que el rol ya
// puede leer por RLS, mismo criterio de agregación cliente-side que
// dashboard/api.ts (Fase 6). No se reutilizan esas funciones tal cual porque
// el Dashboard solo expone conteos (`alertaStockCount`, etc.); la campana
// necesita el ítem individual para poder listarlo y enlazarlo.
export async function listarNotificaciones(rolCodigo: string): Promise<Notificacion[]> {
  if (rolCodigo === 'administrador') {
    const [productos, lotes] = await Promise.all([listarProductos(), listarLotesPorVencer()]);
    const vencimientos = lotes.map<Notificacion>((l) => ({
      id: `lote-${l.id_movimiento}`,
      texto: `Lote por vencer: ${l.producto}`,
      detalle: `${l.lote_codigo ? `Lote ${l.lote_codigo} · ` : ''}vence ${dayjs(l.fecha_vencimiento).format('DD/MM/YYYY')}`,
      ruta: '/inventario',
    }));
    const stock = productos
      .filter((p) => p.activo && p.existencia_actual <= p.nivel_minimo)
      .map<Notificacion>((p) => ({
        id: `stock-${p.id_producto}`,
        texto: `Stock bajo: ${p.nombre}`,
        detalle: `${p.existencia_actual} ${p.unidad_medida} disponibles (mínimo ${p.nivel_minimo})`,
        ruta: '/inventario',
      }));
    return [...vencimientos, ...stock];
  }

  if (rolCodigo === 'recepcionista') {
    const [solicitudes, listaEspera] = await Promise.all([listarSolicitudesPendientes(), listarListaEspera()]);
    const citas = solicitudes.map<Notificacion>((c) => ({
      id: `solicitud-${c.id_cita}`,
      texto: `Solicitud de cita: ${c.paciente.nombre}`,
      detalle: `${c.paciente.propietario.nombres} ${c.paciente.propietario.apellidos} · ${dayjs(c.fecha_hora_inicio).format('DD/MM HH:mm')}`,
      ruta: '/agenda',
    }));
    const espera = listaEspera
      .filter((l) => l.estado === 'pendiente')
      .map<Notificacion>((l) => ({
        id: `espera-${l.id_lista_espera}`,
        texto: `Lista de espera: ${l.paciente.nombre}`,
        detalle: l.motivo,
        ruta: '/agenda',
      }));
    return [...citas, ...espera];
  }

  if (rolCodigo === 'veterinario') {
    const [productos, listaEspera] = await Promise.all([listarProductos(), listarListaEspera()]);
    const stock = productos
      .filter((p) => p.activo && p.existencia_actual <= p.nivel_minimo)
      .map<Notificacion>((p) => ({
        id: `stock-${p.id_producto}`,
        texto: `Stock bajo: ${p.nombre}`,
        detalle: `${p.existencia_actual} ${p.unidad_medida} disponibles (mínimo ${p.nivel_minimo})`,
        ruta: '/inventario',
      }));
    const espera = listaEspera
      .filter((l) => l.estado === 'pendiente')
      .map<Notificacion>((l) => ({
        id: `espera-${l.id_lista_espera}`,
        texto: `Lista de espera: ${l.paciente.nombre}`,
        detalle: l.motivo,
        ruta: '/agenda',
      }));
    return [...stock, ...espera];
  }

  return [];
}
