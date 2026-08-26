import { afterEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { soloFechaLocal } from './fechas';

// Regresion del bug real documentado en CLAUDE.md ("Problemas conocidos"):
// una fecha DATE castida a timestamptz con medianoche UTC ("...T00:00:00+00:00")
// retrocedia un dia calendario al formatearse en un huso detras de UTC. El
// TZ se stubea explicitamente para que la prueba falle en cualquier entorno,
// no solo en uno que ya corra en UTC (donde el bug no se nota).
describe('soloFechaLocal', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('mantiene el mismo dia calendario en un huso detras de UTC (America/Guayaquil, UTC-5)', () => {
    vi.stubEnv('TZ', 'America/Guayaquil');
    const marca = '2026-08-18T00:00:00+00:00';

    expect(dayjs(soloFechaLocal(marca)).format('DD/MM/YYYY')).toBe('18/08/2026');
  });

  it('reproduce el bug si se formatea la marca completa sin pasar por soloFechaLocal', () => {
    vi.stubEnv('TZ', 'America/Guayaquil');
    const marca = '2026-08-18T00:00:00+00:00';

    // Documenta el comportamiento que este helper existe para evitar: sin el
    // recorte a "YYYY-MM-DD", medianoche UTC del 18 se ve como el 17.
    expect(dayjs(marca).format('DD/MM/YYYY')).toBe('17/08/2026');
  });

  it('recorta cualquier timestamp ISO a sus primeros 10 caracteres', () => {
    expect(soloFechaLocal('2026-01-05T14:30:00+00:00')).toBe('2026-01-05');
  });
});
