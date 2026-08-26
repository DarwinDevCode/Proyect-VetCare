import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcularEdadTexto } from '../modules/pacientes/edad';

// "Hoy" fijo para que las pruebas no dependan de cuando se corran.
const HOY = new Date('2026-08-26T12:00:00Z');

describe('calcularEdadTexto', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin fecha de nacimiento devuelve "Edad desconocida" (animal rescatado, RF-010)', () => {
    expect(calcularEdadTexto(null)).toBe('Edad desconocida');
  });

  it('nacido hoy mismo es "Recién nacido"', () => {
    expect(calcularEdadTexto('2026-08-26')).toBe('Recién nacido');
  });

  it('con menos de un año muestra solo meses', () => {
    expect(calcularEdadTexto('2026-05-26')).toBe('3 meses');
  });

  it('un mes exacto usa singular', () => {
    expect(calcularEdadTexto('2026-07-26')).toBe('1 mes');
  });

  it('con años exactos (sin meses sueltos) muestra solo años', () => {
    expect(calcularEdadTexto('2023-08-26')).toBe('3 años');
  });

  it('un año exacto usa singular', () => {
    expect(calcularEdadTexto('2025-08-26')).toBe('1 año');
  });

  it('con años y meses combina ambos', () => {
    expect(calcularEdadTexto('2023-03-15')).toBe('3 años y 5 meses');
  });
});
