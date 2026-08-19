import type { EventoHistorial, TipoEventoHistorial } from '../../types/dominio';

export type EventoInterpretado =
  | { tipo: 'consulta'; motivo: string; diagnostico: string; tratamiento: string | null }
  | { tipo: 'vacunacion'; producto: string }
  | {
      tipo: 'examen';
      tipoExamen: string;
      resultado: string | null;
      observacion: string | null;
      completado: boolean;
    };

// v_historial_clinico reutiliza las mismas columnas posicionalmente para los tres
// tipos de evento (union all). En filas de examen, la columna "tratamiento" de la
// vista es en realidad el resultado del examen (null si aun no se completo) y
// "producto_o_examen" es la observacion -- ver CLAUDE.md seccion 6. Esta funcion es
// el unico lugar del modulo que conoce ese mapeo posicional; el resto del codigo
// siempre consume interpretarEvento(evento), nunca los campos crudos.
export function interpretarEvento(evento: EventoHistorial): EventoInterpretado {
  switch (evento.tipo_evento) {
    case 'consulta':
      return {
        tipo: 'consulta',
        motivo: evento.resumen,
        diagnostico: evento.diagnostico ?? '',
        tratamiento: evento.tratamiento,
      };
    case 'vacunacion':
      return { tipo: 'vacunacion', producto: evento.producto_o_examen ?? '' };
    case 'examen':
      return {
        tipo: 'examen',
        tipoExamen: evento.resumen,
        resultado: evento.tratamiento,
        observacion: evento.producto_o_examen,
        completado: evento.tratamiento !== null,
      };
  }
}

export const ETIQUETA_TIPO_EVENTO: Record<TipoEventoHistorial, string> = {
  consulta: 'Consulta',
  vacunacion: 'Vacunación',
  examen: 'Examen de laboratorio',
};

// info/success/secondary del tema MUI -- "warning" queda reservado por convencion a
// las alertas de stock del Modulo 4, un dominio distinto.
export const COLOR_TIPO_EVENTO: Record<TipoEventoHistorial, 'info' | 'success' | 'secondary'> = {
  consulta: 'info',
  vacunacion: 'success',
  examen: 'secondary',
};
