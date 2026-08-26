import { describe, it, expect } from 'vitest';
import { mensajeError } from '../lib/errors';

// RNF-014: mensajes en espanol, sin codigos ni texto propio del gestor de
// datos. Cubre cada rama del switch para que un cambio futuro no rompa en
// silencio el caso P0001 (CLAUDE.md seccion 9 documenta que ya se rompio una
// vez: los mensajes de fn_emitir_factura caian al "default" generico).
describe('mensajeError', () => {
  it('sin error (null/undefined) da el mensaje generico', () => {
    expect(mensajeError(null)).toBe('Ocurrió un error inesperado. Intenta nuevamente.');
    expect(mensajeError(undefined)).toBe('Ocurrió un error inesperado. Intenta nuevamente.');
  });

  it('23505 (unique_violation) menciona el dato duplicado', () => {
    expect(mensajeError({ code: '23505' })).toContain('mismo dato único');
  });

  it('23503 (foreign_key_violation) menciona una referencia inexistente', () => {
    expect(mensajeError({ code: '23503' })).toContain('no existe o ya no está disponible');
  });

  it('23514 con mensaje de existencia insuficiente lo muestra tal cual', () => {
    const resultado = mensajeError({ code: '23514', message: 'No hay existencia suficiente del producto X' });
    expect(resultado).toBe('No hay existencia suficiente del producto X');
  });

  it('23514 con mensaje de vacuna mal clasificada lo muestra tal cual', () => {
    const resultado = mensajeError({ code: '23514', message: 'El producto no está clasificado como vacuna' });
    expect(resultado).toBe('El producto no está clasificado como vacuna');
  });

  it('23514 con cualquier otro mensaje usa el genérico de regla de negocio', () => {
    const resultado = mensajeError({ code: '23514', message: 'chk_algo_interno_violado' });
    expect(resultado).toContain('no cumplen una regla del sistema');
  });

  it('42501 (insufficient_privilege) menciona el rol', () => {
    expect(mensajeError({ code: '42501' })).toContain('Tu rol no tiene permiso');
  });

  it('23P01 (exclusion_violation) es el mensaje de solapamiento de citas (RN-004)', () => {
    expect(mensajeError({ code: '23P01' })).toBe('El veterinario seleccionado ya tiene una cita en ese horario.');
  });

  it('P0001 (raise exception propio) muestra el mensaje literal de la función SQL', () => {
    const resultado = mensajeError({ code: 'P0001', message: 'Debe indicarse el propietario o la atención a facturar' });
    expect(resultado).toBe('Debe indicarse el propietario o la atención a facturar');
  });

  it('P0001 sin mensaje cae al genérico', () => {
    expect(mensajeError({ code: 'P0001' })).toBe('No se pudo completar la operación.');
  });

  it('código desconocido con mensaje de existencia insuficiente igual lo muestra (RN-010 fuera de 23514)', () => {
    const resultado = mensajeError({ code: '99999', message: 'No hay existencia suficiente' });
    expect(resultado).toBe('No hay existencia suficiente');
  });

  it('código desconocido sin pistas usa el genérico final', () => {
    const resultado = mensajeError({ code: '99999', message: 'algo interno de postgres' });
    expect(resultado).toBe('No se pudo completar la operación. Verifica los datos e intenta nuevamente.');
  });
});
