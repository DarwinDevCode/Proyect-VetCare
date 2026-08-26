import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { citasARangosOcupados, estaDisponible, proximosHuecosLibres } from './disponibilidad';
import type { Cita } from '../../types/dominio';

function citaDeEjemplo(overrides: Partial<Cita>): Cita {
  return {
    id_cita: 1,
    id_paciente: 1,
    id_veterinario: 'vet-1',
    fecha_hora_inicio: '2026-08-26T14:00:00Z',
    duracion_minutos: 30,
    fecha_hora_fin: '2026-08-26T14:30:00Z',
    motivo: null,
    estado: 'programada',
    id_usuario_registro: null,
    fecha_registro: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('citasARangosOcupados', () => {
  it('excluye las citas canceladas (RN-005: liberan su horario)', () => {
    const citas = [citaDeEjemplo({ id_cita: 1, estado: 'cancelada' }), citaDeEjemplo({ id_cita: 2, estado: 'programada' })];
    expect(citasARangosOcupados(citas)).toHaveLength(1);
  });

  it('excluye la propia cita al reprogramar (idCitaExcluir)', () => {
    const citas = [citaDeEjemplo({ id_cita: 5 })];
    expect(citasARangosOcupados(citas, 5)).toHaveLength(0);
  });

  it('sin exclusiones, mapea fecha_hora_inicio/fin a Dayjs', () => {
    const citas = [citaDeEjemplo({})];
    const [rango] = citasARangosOcupados(citas);
    expect(rango.inicio.isSame(dayjs('2026-08-26T14:00:00Z'))).toBe(true);
    expect(rango.fin.isSame(dayjs('2026-08-26T14:30:00Z'))).toBe(true);
  });
});

describe('estaDisponible', () => {
  const ocupado = { inicio: dayjs('2026-08-26T14:00:00Z'), fin: dayjs('2026-08-26T14:30:00Z') };

  it('un horario que no se cruza con nada está disponible', () => {
    expect(estaDisponible(dayjs('2026-08-26T15:00:00Z'), dayjs('2026-08-26T15:30:00Z'), [ocupado])).toBe(true);
  });

  it('un horario que se solapa completamente no está disponible', () => {
    expect(estaDisponible(dayjs('2026-08-26T14:00:00Z'), dayjs('2026-08-26T14:30:00Z'), [ocupado])).toBe(false);
  });

  it('un horario que se solapa parcialmente (empieza antes, termina adentro) no está disponible', () => {
    expect(estaDisponible(dayjs('2026-08-26T13:45:00Z'), dayjs('2026-08-26T14:15:00Z'), [ocupado])).toBe(false);
  });

  it('un horario que termina justo cuando empieza el ocupado sí está disponible (sin solape real)', () => {
    expect(estaDisponible(dayjs('2026-08-26T13:30:00Z'), dayjs('2026-08-26T14:00:00Z'), [ocupado])).toBe(true);
  });
});

describe('proximosHuecosLibres (RF-011: sugerencias cuando el horario pedido no está libre)', () => {
  it('un día completamente vacío sugiere el inicio de la jornada', () => {
    const [primero] = proximosHuecosLibres(dayjs('2026-08-26'), 30, [], 8, 18);
    expect(primero.inicio.hour()).toBe(8);
    expect(primero.inicio.minute()).toBe(0);
  });

  it('salta el hueco ocupado y sugiere justo después', () => {
    const fecha = dayjs('2026-08-26');
    const ocupado = {
      inicio: fecha.hour(8).minute(0),
      fin: fecha.hour(9).minute(0),
    };
    const [primero] = proximosHuecosLibres(fecha, 30, [ocupado], 8, 18);
    expect(primero.inicio.hour()).toBe(9);
  });

  it('no sugiere nada si la jornada ya está completamente ocupada', () => {
    const fecha = dayjs('2026-08-26');
    const ocupado = { inicio: fecha.hour(8).minute(0), fin: fecha.hour(18).minute(0) };
    expect(proximosHuecosLibres(fecha, 30, [ocupado], 8, 18)).toHaveLength(0);
  });

  it('respeta el máximo de sugerencias pedido', () => {
    const fecha = dayjs('2026-08-26');
    // Cinco huecos ocupados de 10 minutos separados por 10 minutos libres --
    // no alcanzan para una cita de 30 minutos entre ellos, asi que solo se
    // sugiere al final del ultimo ocupado en adelante.
    const ocupados = Array.from({ length: 3 }, (_, i) => ({
      inicio: fecha.hour(8 + i * 2).minute(0),
      fin: fecha.hour(8 + i * 2).minute(30),
    }));
    const sugerencias = proximosHuecosLibres(fecha, 60, ocupados, 8, 18, 2);
    expect(sugerencias.length).toBeLessThanOrEqual(2);
  });
});
