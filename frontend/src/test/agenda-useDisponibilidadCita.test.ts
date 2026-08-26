import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import dayjs from 'dayjs';
import { useDisponibilidadCita } from '../modules/agenda/useDisponibilidadCita';

const { listarCitasDelDiaMock } = vi.hoisted(() => ({ listarCitasDelDiaMock: vi.fn() }));
vi.mock('../modules/agenda/api', () => ({ listarCitasDelDia: listarCitasDelDiaMock }));

const FECHA = dayjs('2026-08-27');
const VETERINARIO = 'v1';

function citaOcupada(horaInicio: string, horaFin: string, estado = 'programada') {
  return {
    id_cita: 1,
    id_veterinario: VETERINARIO,
    fecha_hora_inicio: `2026-08-27T${horaInicio}:00-05:00`,
    fecha_hora_fin: `2026-08-27T${horaFin}:00-05:00`,
    estado,
  };
}

// Avanza el debounce de 300ms del hook Y deja que la promesa de
// listarCitasDelDia (y los setState que dispara) terminen de resolverse,
// todo dentro de act() -- sin esto, waitFor() se cuelga indefinidamente con
// fake timers activos (su propio polling depende de setTimeout real).
async function avanzarDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe('useDisponibilidadCita', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('un horario libre se marca disponible, sin sugerencias', async () => {
    listarCitasDelDiaMock.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useDisponibilidadCita({
        activo: true,
        idVeterinario: VETERINARIO,
        fecha: FECHA,
        hora: dayjs('2026-08-27T10:00'),
        duracionMinutos: 30,
      }),
    );

    await avanzarDebounce();

    expect(result.current.verificando).toBe(false);
    expect(result.current.disponible).toBe(true);
    expect(result.current.sugerencias).toEqual([]);
  });

  it('un horario ocupado se marca no disponible y trae sugerencias', async () => {
    listarCitasDelDiaMock.mockResolvedValue([citaOcupada('10:00', '10:30')]);
    const { result } = renderHook(() =>
      useDisponibilidadCita({
        activo: true,
        idVeterinario: VETERINARIO,
        fecha: FECHA,
        hora: dayjs('2026-08-27T10:00'),
        duracionMinutos: 30,
      }),
    );

    await avanzarDebounce();

    expect(result.current.disponible).toBe(false);
    expect(result.current.sugerencias.length).toBeGreaterThan(0);
  });

  it('una cita cancelada no cuenta como ocupada (RN-005: libera el horario)', async () => {
    listarCitasDelDiaMock.mockResolvedValue([citaOcupada('10:00', '10:30', 'cancelada')]);
    const { result } = renderHook(() =>
      useDisponibilidadCita({
        activo: true,
        idVeterinario: VETERINARIO,
        fecha: FECHA,
        hora: dayjs('2026-08-27T10:00'),
        duracionMinutos: 30,
      }),
    );

    await avanzarDebounce();

    expect(result.current.disponible).toBe(true);
  });

  // Regresion del bug real documentado en CLAUDE.md ("Problemas conocidos"):
  // reabrir el dialogo de "Nueva cita" para el MISMO veterinario/dia no
  // volvia a consultar la agenda, porque el efecto solo dependia de
  // [idVeterinario, fecha] -- si ninguno cambiaba entre una apertura y la
  // siguiente, React no lo volvia a ejecutar, y el chequeo seguia usando
  // datos obsoletos (no veia una cita recien creada en el interin). El
  // parametro `activo` en las dependencias es el fix: un false->true fuerza
  // la recarga aunque veterinario/fecha repitan el mismo valor.
  it('cerrar y reabrir el diálogo (activo false->true) para el mismo veterinario/día vuelve a consultar la agenda', async () => {
    listarCitasDelDiaMock.mockResolvedValue([]);
    const { rerender } = renderHook(
      (props: { activo: boolean }) =>
        useDisponibilidadCita({
          activo: props.activo,
          idVeterinario: VETERINARIO,
          fecha: FECHA,
          hora: dayjs('2026-08-27T10:00'),
          duracionMinutos: 30,
        }),
      { initialProps: { activo: true } },
    );

    await avanzarDebounce();
    expect(listarCitasDelDiaMock).toHaveBeenCalledTimes(1);

    // Cierra el dialogo (activo=false) -- no debe consultar de nuevo.
    rerender({ activo: false });
    await avanzarDebounce();
    expect(listarCitasDelDiaMock).toHaveBeenCalledTimes(1);

    // Reabre para el MISMO veterinario y la MISMA fecha -- sin el fix, React
    // no volveria a ejecutar el efecto (mismas dependencias que la primera
    // vez) y esta aserción fallaría en 1, no en 2.
    rerender({ activo: true });
    await avanzarDebounce();
    expect(listarCitasDelDiaMock).toHaveBeenCalledTimes(2);
  });
});
