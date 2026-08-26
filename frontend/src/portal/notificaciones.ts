import dayjs from 'dayjs';
import { listarMisCitas, listarMisFacturas } from './api';
import { formatoMoneda } from '../modules/facturacion/formato';

export interface NotificacionPortal {
  id: string;
  texto: string;
  detalle: string;
  ruta: string;
}

// Mismo patron que layout/notificaciones.ts (personal): sin tabla propia, sin
// distinguir leidas/no leidas -- cada apertura recalcula la lista vigente a
// partir de lo que el propietario ya puede leer por RLS (cita_select_portal,
// factura_select_portal).
export async function listarNotificacionesPortal(): Promise<NotificacionPortal[]> {
  const [citas, facturas] = await Promise.all([listarMisCitas(), listarMisFacturas()]);
  const ahora = dayjs();

  const solicitudes = citas
    .filter((c) => c.estado === 'solicitada')
    .map<NotificacionPortal>((c) => ({
      id: `solicitud-${c.id_cita}`,
      texto: `Solicitud enviada: ${c.paciente.nombre}`,
      detalle: 'Esperando confirmación de la clínica',
      ruta: '/portal/citas',
    }));

  const confirmadas = citas
    .filter((c) => c.estado === 'programada' && dayjs(c.fecha_hora_inicio).isAfter(ahora))
    .sort((a, b) => dayjs(a.fecha_hora_inicio).diff(dayjs(b.fecha_hora_inicio)))
    .map<NotificacionPortal>((c) => ({
      id: `confirmada-${c.id_cita}`,
      texto: `Cita confirmada: ${c.paciente.nombre}`,
      detalle: c.veterinario
        ? `${dayjs(c.fecha_hora_inicio).format('DD/MM/YYYY HH:mm')} con ${c.veterinario.nombres} ${c.veterinario.apellidos}`
        : dayjs(c.fecha_hora_inicio).format('DD/MM/YYYY HH:mm'),
      ruta: '/portal/citas',
    }));

  const pendientes = facturas
    .filter((f) => f.estado_cobro !== 'pagada')
    .map<NotificacionPortal>((f) => ({
      id: `factura-${f.id_factura}`,
      texto: `Factura pendiente: ${f.numero}`,
      detalle: `Saldo: ${formatoMoneda(f.saldo_pendiente)}`,
      ruta: '/portal/facturas',
    }));

  return [...solicitudes, ...confirmadas, ...pendientes];
}
