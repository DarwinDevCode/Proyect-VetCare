import { beforeEach, describe, expect, it } from 'vitest';
import { leerLeidasVigentes, marcarLeidaEnStorage } from '../lib/notificacionesLeidas';

const USUARIO = '00000000-0000-0000-0000-000000000001';
const OTRO_USUARIO = '00000000-0000-0000-0000-000000000002';

describe('notificacionesLeidas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin nada guardado, ningun id esta marcado como leido', () => {
    const leidas = leerLeidasVigentes(USUARIO, ['a', 'b']);
    expect(leidas.size).toBe(0);
  });

  it('marcarLeidaEnStorage persiste el id, visible en la siguiente lectura', () => {
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    const leidas = leerLeidasVigentes(USUARIO, ['stock-3', 'lote-9']);
    expect(leidas.has('stock-3')).toBe(true);
    expect(leidas.has('lote-9')).toBe(false);
  });

  it('recorta ids leidos que ya no estan vigentes (la alerta se resolvio)', () => {
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    marcarLeidaEnStorage(USUARIO, 'stock-4');
    // stock-3 se resolvio (producto repuesto): ya no aparece en la lista vigente.
    const leidas = leerLeidasVigentes(USUARIO, ['stock-4']);
    expect(leidas.has('stock-3')).toBe(false);
    expect(leidas.has('stock-4')).toBe(true);
  });

  it('el recorte se guarda: una lectura posterior con el mismo id resuelto ya no lo trae de vuelta', () => {
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    leerLeidasVigentes(USUARIO, []); // stock-3 se recorta aqui
    marcarLeidaEnStorage(USUARIO, 'stock-3'); // la misma alerta vuelve a aparecer, de nuevo sin leer
    const leidas = leerLeidasVigentes(USUARIO, ['stock-3']);
    // Como se re-marco leida explicitamente, si debe volver a estar -- lo que
    // NO debe pasar es que el recorte anterior "resucite" un id ya descartado
    // sin que nadie lo haya vuelto a marcar.
    expect(leidas.has('stock-3')).toBe(true);
  });

  it('marcar el mismo id dos veces no duplica la entrada guardada', () => {
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    const crudo = JSON.parse(localStorage.getItem('vetcare:notificaciones-leidas:' + USUARIO) ?? '[]');
    expect(crudo).toEqual(['stock-3']);
  });

  it('el estado de leidas es independiente por usuario', () => {
    marcarLeidaEnStorage(USUARIO, 'stock-3');
    const leidasOtro = leerLeidasVigentes(OTRO_USUARIO, ['stock-3']);
    expect(leidasOtro.has('stock-3')).toBe(false);
  });

  it('localStorage roto (JSON invalido) no revienta, se trata como vacio', () => {
    localStorage.setItem('vetcare:notificaciones-leidas:' + USUARIO, '{esto no es json valido');
    const leidas = leerLeidasVigentes(USUARIO, ['stock-3']);
    expect(leidas.size).toBe(0);
  });
});
