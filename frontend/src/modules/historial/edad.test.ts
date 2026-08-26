import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcularEdadTexto } from './edad';

// Este archivo es un duplicado byte a byte de modules/pacientes/edad.ts (no
// se investigó por qué existen dos copias -- posible resto de cuando
// Historial e Inventario se fusionaron con Pacientes, ver CLAUDE.md sección
// 9). Se prueba igual porque son dos módulos independientes en tiempo de
// compilación: uno podría divergir del otro sin que ninguna prueba lo note.
const HOY = new Date('2026-08-26T12:00:00Z');

describe('calcularEdadTexto (modules/historial)', () => {
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

  it('con años y meses combina ambos', () => {
    expect(calcularEdadTexto('2023-03-15')).toBe('3 años y 5 meses');
  });
});
