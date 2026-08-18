import dayjs, { type Dayjs } from 'dayjs';
import type { Cita } from '../../types/dominio';

// Jornada de atencion por defecto: el SRS no fija un horario, es un valor razonable
// que AgendaGrid.tsx reutiliza para que el grid y el calculo de huecos coincidan.
export const HORA_INICIO_ATENCION = 8;
export const HORA_FIN_ATENCION = 18;

export interface RangoOcupado {
  inicio: Dayjs;
  fin: Dayjs;
}

// RN-005: una cita cancelada libera su horario, por eso se excluye. idCitaExcluir es
// la propia cita al reprogramar, para que no choque contra si misma.
export function citasARangosOcupados(citas: Cita[], idCitaExcluir?: number): RangoOcupado[] {
  return citas
    .filter((c) => c.estado !== 'cancelada' && c.id_cita !== idCitaExcluir)
    .map((c) => ({ inicio: dayjs(c.fecha_hora_inicio), fin: dayjs(c.fecha_hora_fin) }));
}

export function estaDisponible(inicio: Dayjs, fin: Dayjs, ocupados: RangoOcupado[]): boolean {
  return !ocupados.some((r) => inicio.isBefore(r.fin) && fin.isAfter(r.inicio));
}

// RF-011: "cuando el horario no este disponible, el sistema debe informar los
// espacios libres proximos". Recorre los ocupados ordenados por inicio, acumulando
// un cursor desde el inicio de la jornada y emitiendo un hueco cada vez que el
// espacio libre antes del proximo ocupado alcanza para la duracion pedida.
export function proximosHuecosLibres(
  fecha: Dayjs,
  duracionMinutos: number,
  ocupados: RangoOcupado[],
  horaInicioAtencion: number = HORA_INICIO_ATENCION,
  horaFinAtencion: number = HORA_FIN_ATENCION,
  maxSugerencias = 3,
): RangoOcupado[] {
  const inicioJornada = fecha.hour(horaInicioAtencion).minute(0).second(0).millisecond(0);
  const finJornada = fecha.hour(horaFinAtencion).minute(0).second(0).millisecond(0);
  const ordenados = [...ocupados].sort((a, b) => a.inicio.valueOf() - b.inicio.valueOf());

  const huecos: RangoOcupado[] = [];
  let cursor = inicioJornada;

  for (const rango of ordenados) {
    if (huecos.length >= maxSugerencias) break;
    if (rango.inicio.isAfter(cursor) && rango.inicio.diff(cursor, 'minute') >= duracionMinutos) {
      huecos.push({ inicio: cursor, fin: cursor.add(duracionMinutos, 'minute') });
    }
    if (rango.fin.isAfter(cursor)) cursor = rango.fin;
  }

  if (huecos.length < maxSugerencias && finJornada.diff(cursor, 'minute') >= duracionMinutos) {
    huecos.push({ inicio: cursor, fin: cursor.add(duracionMinutos, 'minute') });
  }

  return huecos.slice(0, maxSugerencias);
}
