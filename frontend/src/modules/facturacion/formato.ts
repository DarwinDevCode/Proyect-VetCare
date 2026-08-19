import type { EstadoCobro, FormaPago } from '../../types/dominio';

// El SRS exige registrar el impuesto de cada factura (RF-028) pero no fija ninguna
// tasa: es un valor a definir con la clinica, como los TBD de RNF-016/018/019. Se
// deja 15 como valor inicial del formulario --el IVA vigente en Ecuador-- y se
// puede cambiar en cada emision; no esta escrito en la base ni en el servidor
// justamente para no dar por cerrada una decision que es del cliente.
export const PORCENTAJE_IMPUESTO_POR_DEFECTO = 15;

// RNF-011: toda la interfaz en espanol.
const FORMATO = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export function formatoMoneda(valor: number): string {
  return FORMATO.format(Number(valor) || 0);
}

export const ETIQUETA_ESTADO_COBRO: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagada: 'Pagada',
};

export const COLOR_ESTADO_COBRO: Record<EstadoCobro, 'default' | 'warning' | 'success'> = {
  pendiente: 'default',
  parcial: 'warning',
  pagada: 'success',
};

export const ETIQUETA_FORMA_PAGO: Record<FormaPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};
