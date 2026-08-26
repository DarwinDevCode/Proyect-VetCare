import { describe, it, expect } from 'vitest';
import { formatoMoneda, ETIQUETA_ESTADO_COBRO, COLOR_ESTADO_COBRO, ETIQUETA_FORMA_PAGO } from './formato';

describe('formatoMoneda', () => {
  it('formatea un monto positivo como moneda en español (es-EC/USD)', () => {
    expect(formatoMoneda(17.25)).toBe('$17,25');
  });

  it('formatea cero', () => {
    expect(formatoMoneda(0)).toBe('$0,00');
  });

  it('trata NaN/valores no numéricos como cero en vez de mostrar "NaN"', () => {
    expect(formatoMoneda(Number('no es un numero'))).toBe('$0,00');
  });

  it('redondea a dos decimales', () => {
    expect(formatoMoneda(20.706)).toBe('$20,71');
  });
});

describe('mapas de etiquetas de facturación', () => {
  it('cubre los tres estados de cobro (EstadoCobro)', () => {
    expect(ETIQUETA_ESTADO_COBRO.pendiente).toBe('Pendiente');
    expect(ETIQUETA_ESTADO_COBRO.parcial).toBe('Pago parcial');
    expect(ETIQUETA_ESTADO_COBRO.pagada).toBe('Pagada');
  });

  it('cada estado de cobro tiene un color asociado', () => {
    expect(COLOR_ESTADO_COBRO.pendiente).toBe('default');
    expect(COLOR_ESTADO_COBRO.parcial).toBe('warning');
    expect(COLOR_ESTADO_COBRO.pagada).toBe('success');
  });

  it('cubre las tres formas de pago (efectivo/tarjeta/transferencia, sin Yape/Plin/Crédito)', () => {
    expect(ETIQUETA_FORMA_PAGO.efectivo).toBe('Efectivo');
    expect(ETIQUETA_FORMA_PAGO.tarjeta).toBe('Tarjeta');
    expect(ETIQUETA_FORMA_PAGO.transferencia).toBe('Transferencia');
  });
});
