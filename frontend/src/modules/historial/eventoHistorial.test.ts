import { describe, expect, it } from 'vitest';
import { interpretarEvento } from './eventoHistorial';
import type { EventoHistorial } from '../../types/dominio';

function evento(parcial: Partial<EventoHistorial>): EventoHistorial {
  return {
    id_paciente: 1,
    tipo_evento: 'consulta',
    fecha: '2026-08-10T09:00:00-05:00',
    id_evento: 1,
    resumen: '',
    diagnostico: null,
    tratamiento: null,
    producto_o_examen: null,
    id_veterinario: 'v1',
    temperatura_c: null,
    frecuencia_cardiaca_lpm: null,
    frecuencia_respiratoria_rpm: null,
    ...parcial,
  };
}

// v_historial_clinico reutiliza las mismas columnas posicionalmente para los
// tres tipos de evento (union all) -- interpretarEvento es el unico lugar que
// conoce ese mapeo (ver el comentario en eventoHistorial.ts). Si alguien
// cambia el orden de columnas de la vista sin actualizar esta funcion, un
// examen completado empezaria a mostrarse como si no tuviera resultado, o
// viceversa -- exactamente el tipo de bug que no se nota mirando la pantalla
// una sola vez.
describe('interpretarEvento', () => {
  it('consulta: expone motivo/diagnostico/tratamiento/signos vitales tal cual', () => {
    const resultado = interpretarEvento(
      evento({
        tipo_evento: 'consulta',
        resumen: 'Control anual',
        diagnostico: 'Paciente sano',
        tratamiento: 'Vacuna de refuerzo',
        temperatura_c: 38.4,
        frecuencia_cardiaca_lpm: 90,
        frecuencia_respiratoria_rpm: 22,
      }),
    );
    expect(resultado).toEqual({
      tipo: 'consulta',
      motivo: 'Control anual',
      diagnostico: 'Paciente sano',
      tratamiento: 'Vacuna de refuerzo',
      temperaturaC: 38.4,
      frecuenciaCardiacaLpm: 90,
      frecuenciaRespiratoriaRpm: 22,
    });
  });

  it('consulta sin diagnostico registrado devuelve cadena vacia, no null', () => {
    const resultado = interpretarEvento(evento({ tipo_evento: 'consulta', diagnostico: null }));
    expect(resultado).toMatchObject({ tipo: 'consulta', diagnostico: '' });
  });

  it('vacunacion: el nombre del producto viaja en producto_o_examen, no en resumen', () => {
    const resultado = interpretarEvento(
      evento({ tipo_evento: 'vacunacion', resumen: 'Vacunacion aplicada', producto_o_examen: 'Vacuna Antirrábica' }),
    );
    expect(resultado).toEqual({ tipo: 'vacunacion', producto: 'Vacuna Antirrábica' });
  });

  it('examen SIN resultado todavia: tratamiento (resultado) es null y completado es false', () => {
    const resultado = interpretarEvento(
      evento({ tipo_evento: 'examen', resumen: 'Hemograma completo', tratamiento: null, producto_o_examen: 'Pendiente' }),
    );
    expect(resultado).toEqual({
      tipo: 'examen',
      tipoExamen: 'Hemograma completo',
      resultado: null,
      observacion: 'Pendiente',
      completado: false,
    });
  });

  it('examen YA completado: tratamiento (resultado) trae el texto y completado es true', () => {
    const resultado = interpretarEvento(
      evento({
        tipo_evento: 'examen',
        resumen: 'Hemograma completo',
        tratamiento: 'Leucocitosis leve.',
        producto_o_examen: null,
      }),
    );
    expect(resultado).toEqual({
      tipo: 'examen',
      tipoExamen: 'Hemograma completo',
      resultado: 'Leucocitosis leve.',
      observacion: null,
      completado: true,
    });
  });
});
