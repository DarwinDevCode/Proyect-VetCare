import dayjs from 'dayjs';
import type { CitaConDetalle } from '../../types/dominio';
import { listarCitasDelDia, listarListaEspera, listarSolicitudesPendientes } from '../agenda/api';
import { listarOrdenesCompra } from '../compras/api';
import { listarFacturas, listarPagosDelPeriodo } from '../facturacion/api';
import { listarLotesPorVencer, listarProductos } from '../inventario/api';

// Fase 6: agregaciones cliente-side sobre datos que cada rol ya puede leer via RLS
// (cita/pago/producto/lista_espera/orden_compra) -- sin migracion nueva, sin vista
// nueva. Cada resumen solo consulta lo que su rol puede ver: no se ofrece un KPI de
// una tabla a la que la RLS de todas formas respondera "[]"/403 (mismo criterio que
// el resto del proyecto, ver CLAUDE.md seccion 9).

export interface ResumenRecepcionista {
  citasHoy: CitaConDetalle[];
  solicitudesPendientes: number;
  listaEsperaPendiente: number;
  ingresosHoy: number;
}

// Recepcionista: Modulo 1 (lee), 2 (lee y escribe), 5 (lee y escribe).
export async function obtenerResumenRecepcionista(): Promise<ResumenRecepcionista> {
  const hoy = dayjs().format('YYYY-MM-DD');
  const [citasHoy, solicitudes, listaEspera, pagosHoy] = await Promise.all([
    listarCitasDelDia(hoy),
    listarSolicitudesPendientes(),
    listarListaEspera(),
    listarPagosDelPeriodo(hoy, hoy),
  ]);
  return {
    citasHoy: citasHoy.filter((c) => c.estado !== 'cancelada'),
    solicitudesPendientes: solicitudes.length,
    listaEsperaPendiente: listaEspera.filter((l) => l.estado === 'pendiente').length,
    ingresosHoy: pagosHoy.reduce((suma, p) => suma + Number(p.monto), 0),
  };
}

export interface ResumenVeterinario {
  citasHoy: CitaConDetalle[];
  alertaStockCount: number;
  listaEsperaPendiente: number;
}

// Veterinario: Modulo 1 (lee), 2 (lee), 3 (exclusivo), 4 (consumo + catalogo).
// Las citas se filtran a las propias del veterinario que inicio sesion -- a
// diferencia de AgendaPage (que muestra la agenda completa a proposito, RLS lo
// permite), aqui el resumen es personal: "tu dia", no el de toda la clinica.
export async function obtenerResumenVeterinario(idVeterinario: string): Promise<ResumenVeterinario> {
  const hoy = dayjs().format('YYYY-MM-DD');
  const [citasHoy, productos, listaEspera] = await Promise.all([
    listarCitasDelDia(hoy),
    listarProductos(),
    listarListaEspera(),
  ]);
  return {
    citasHoy: citasHoy.filter((c) => c.id_veterinario === idVeterinario && c.estado !== 'cancelada'),
    alertaStockCount: productos.filter((p) => p.activo && p.existencia_actual <= p.nivel_minimo).length,
    listaEsperaPendiente: listaEspera.filter((l) => l.estado === 'pendiente').length,
  };
}

export interface ResumenAdministrador {
  ingresosHoy: number;
  alertaStockCount: number;
  lotesPorVencerCount: number;
  ordenesPendientesCount: number;
  facturasPendientesCount: number;
}

// Administrador: Modulo 4 (catalogo/ingresos), 5 (lee + reporte), 6/7 (exclusivos).
export async function obtenerResumenAdministrador(): Promise<ResumenAdministrador> {
  const hoy = dayjs().format('YYYY-MM-DD');
  const [pagosHoy, productos, lotes, ordenes, facturas] = await Promise.all([
    listarPagosDelPeriodo(hoy, hoy),
    listarProductos(),
    listarLotesPorVencer(),
    listarOrdenesCompra(),
    listarFacturas({ desde: null, hasta: null, propietario: '', estadoCobro: '' }),
  ]);
  return {
    ingresosHoy: pagosHoy.reduce((suma, p) => suma + Number(p.monto), 0),
    alertaStockCount: productos.filter((p) => p.activo && p.existencia_actual <= p.nivel_minimo).length,
    lotesPorVencerCount: lotes.length,
    ordenesPendientesCount: ordenes.filter((o) => o.estado === 'borrador' || o.estado === 'emitida').length,
    facturasPendientesCount: facturas.filter((f) => f.estado_cobro !== 'pagada').length,
  };
}
