import { useEffect, useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';
import type { Cita } from '../../types/dominio';
import { listarCitasDelDia } from './api';
import {
  citasARangosOcupados,
  estaDisponible,
  proximosHuecosLibres,
  type RangoOcupado,
} from './disponibilidad';

interface Params {
  // Debe pasarse en true solo mientras el chequeo importa (dialogo abierto /
  // reprogramando). Un cambio false->true fuerza una recarga aunque veterinario y
  // fecha tengan el mismo valor que la vez anterior -- sin esto, cerrar y volver a
  // abrir el dialogo para el mismo veterinario/dia reutiliza datos ya obsoletos,
  // porque React no vuelve a ejecutar el efecto si sus dependencias no cambiaron.
  activo: boolean;
  idVeterinario: string;
  fecha: Dayjs | null;
  hora: Dayjs | null;
  duracionMinutos: number;
  idCitaExcluir?: number;
}

interface Resultado {
  verificando: boolean;
  disponible: boolean | undefined;
  sugerencias: RangoOcupado[];
}

// RF-011: verificacion de disponibilidad en vivo mientras se elige veterinario, fecha,
// hora y duracion. La comparten NuevaCitaDialog y CitaDetalleDialog (reprogramar) a
// traves de SelectorHorarioCita. El EXCLUDE de la base (RN-004) sigue siendo la
// garantia real ante condiciones de carrera; esto es solo retroalimentacion inmediata.
export function useDisponibilidadCita({
  activo,
  idVeterinario,
  fecha,
  hora,
  duracionMinutos,
  idCitaExcluir,
}: Params): Resultado {
  const [citasDelVeterinario, setCitasDelVeterinario] = useState<Cita[]>([]);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!activo || !idVeterinario || !fecha) {
      setCitasDelVeterinario([]);
      return;
    }

    let vigente = true;
    setVerificando(true);
    const temporizador = setTimeout(() => {
      listarCitasDelDia(fecha.format('YYYY-MM-DD'))
        .then((citas) => {
          if (vigente) setCitasDelVeterinario(citas.filter((c) => c.id_veterinario === idVeterinario));
        })
        .finally(() => vigente && setVerificando(false));
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [activo, idVeterinario, fecha]);

  const ocupados = useMemo(
    () => citasARangosOcupados(citasDelVeterinario, idCitaExcluir),
    [citasDelVeterinario, idCitaExcluir],
  );

  return useMemo(() => {
    if (!idVeterinario || !fecha || !hora || !duracionMinutos || duracionMinutos <= 0 || verificando) {
      return { verificando, disponible: undefined, sugerencias: [] };
    }

    const inicio = fecha.hour(hora.hour()).minute(hora.minute()).second(0).millisecond(0);
    const fin = inicio.add(duracionMinutos, 'minute');
    const disponible = estaDisponible(inicio, fin, ocupados);
    const sugerencias = disponible ? [] : proximosHuecosLibres(fecha, duracionMinutos, ocupados);

    return { verificando, disponible, sugerencias };
  }, [idVeterinario, fecha, hora, duracionMinutos, ocupados, verificando]);
}
