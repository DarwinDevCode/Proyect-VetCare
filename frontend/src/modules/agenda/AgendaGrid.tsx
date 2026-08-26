import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import type { CitaConDetalle, Usuario } from '../../types/dominio';
import { BloqueCita } from './BloqueCita';
import { HORA_FIN_ATENCION, HORA_INICIO_ATENCION } from './disponibilidad';

const ALTO_SLOT_PX = 48;
const MINUTOS_POR_SLOT = 30;
const ANCHO_GUTTER_PX = 56;
const ANCHO_COLUMNA_PX = 200;
const ALTO_ENCABEZADO_PX = 40;

interface Props {
  fecha: Dayjs;
  veterinarios: Usuario[];
  citas: CitaConDetalle[];
  // RF-011/RF-012 son exclusivos de recepcionista (RLS ya lo exige en el servidor;
  // esto evita ademas que un veterinario vea un hueco vacio como "clicable" cuando
  // en realidad no puede crear nada ahi).
  puedeCrear: boolean;
  onClickSlotVacio: (idVeterinario: string, hora: Dayjs) => void;
  onClickCita: (cita: CitaConDetalle) => void;
}

// El horario de atencion por defecto es 08:00-18:00 (disponibilidad.ts), pero una
// cita real puede caer fuera de ese rango (p. ej. una urgencia temprano) -- el grid
// se expande para nunca recortar una cita ya registrada.
function calcularRangoHoras(citas: CitaConDetalle[]): { horaInicio: number; horaFin: number } {
  let horaInicio = HORA_INICIO_ATENCION;
  let horaFin = HORA_FIN_ATENCION;
  for (const c of citas) {
    const inicio = dayjs(c.fecha_hora_inicio);
    const fin = dayjs(c.fecha_hora_fin);
    horaInicio = Math.min(horaInicio, inicio.hour());
    horaFin = Math.max(horaFin, fin.minute() > 0 ? fin.hour() + 1 : fin.hour());
  }
  return { horaInicio, horaFin };
}

function topPx(momento: Dayjs, horaInicio: number): number {
  const minutos = (momento.hour() - horaInicio) * 60 + momento.minute();
  return (minutos / MINUTOS_POR_SLOT) * ALTO_SLOT_PX;
}

// RF-013: grid dia x veterinario. Clic en una celda vacia crea una cita ahi (RF-012);
// clic en un bloque abre su detalle (reprogramar/cancelar, RF-014/RF-015).
export function AgendaGrid({ fecha, veterinarios, citas, puedeCrear, onClickSlotVacio, onClickCita }: Props) {
  const { horaInicio, horaFin } = useMemo(() => calcularRangoHoras(citas), [citas]);
  const totalSlots = ((horaFin - horaInicio) * 60) / MINUTOS_POR_SLOT;
  const alturaTotal = totalSlots * ALTO_SLOT_PX;

  const inicioJornada = useMemo(
    () => fecha.hour(horaInicio).minute(0).second(0).millisecond(0),
    [fecha, horaInicio],
  );
  const slots = useMemo(
    () => Array.from({ length: totalSlots }, (_, i) => inicioJornada.add(i * MINUTOS_POR_SLOT, 'minute')),
    [inicioJornada, totalSlots],
  );
  const horas = useMemo(
    () => Array.from({ length: horaFin - horaInicio + 1 }, (_, i) => horaInicio + i),
    [horaInicio, horaFin],
  );

  const esHoy = fecha.isSame(dayjs(), 'day');
  const [ahora, setAhora] = useState(() => dayjs());
  useEffect(() => {
    if (!esHoy) return;
    const intervalo = setInterval(() => setAhora(dayjs()), 60_000);
    return () => clearInterval(intervalo);
  }, [esHoy]);

  const contenedorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!esHoy || !contenedorRef.current) return;
    contenedorRef.current.scrollTop = Math.max(topPx(dayjs(), horaInicio) - 120, 0);
    // Solo al entrar al dia de hoy -- no se debe reenganchar el scroll cada vez que
    // "ahora" avanza un minuto, por eso "ahora" no esta en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esHoy, fecha, horaInicio]);

  // 'solicitada' (Fase 5) nunca tiene veterinario todavia -- se excluye del grid
  // (agrupado por veterinario) y se muestra aparte en AgendaPage.
  const citasPorVeterinario = useMemo(() => {
    const mapa = new Map<string, CitaConDetalle[]>();
    for (const c of citas) {
      if (!c.id_veterinario) continue;
      if (!mapa.has(c.id_veterinario)) mapa.set(c.id_veterinario, []);
      mapa.get(c.id_veterinario)!.push(c);
    }
    return mapa;
  }, [citas]);

  return (
    <Box
      ref={contenedorRef}
      sx={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 280px)',
        minHeight: 360,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', position: 'relative', width: 'fit-content', minWidth: '100%' }}>
        {/* Columna de horas, fija a la izquierda al desplazar horizontalmente */}
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 3,
            bgcolor: 'background.paper',
            width: ANCHO_GUTTER_PX,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ height: ALTO_ENCABEZADO_PX, borderBottom: 1, borderColor: 'divider' }} />
          <Box sx={{ position: 'relative', height: alturaTotal }}>
            {horas.map((h) => (
              <Typography
                key={h}
                variant="caption"
                color="text.secondary"
                sx={{ position: 'absolute', top: (h - horaInicio) * (60 / MINUTOS_POR_SLOT) * ALTO_SLOT_PX - 7, right: 6 }}
              >
                {String(h).padStart(2, '0')}:00
              </Typography>
            ))}
          </Box>
        </Box>

        {veterinarios.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No hay veterinarios seleccionados.
            </Typography>
          </Box>
        ) : (
          veterinarios.map((vet) => (
            <Box
              key={vet.id_usuario}
              sx={{ width: ANCHO_COLUMNA_PX, flexShrink: 0, borderRight: 1, borderColor: 'divider' }}
            >
              <Box
                sx={{
                  height: ALTO_ENCABEZADO_PX,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                  px: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {vet.nombres} {vet.apellidos}
                </Typography>
              </Box>

              <Box sx={{ position: 'relative', height: alturaTotal }}>
                {slots.map((horaSlot, i) => (
                  <Box
                    key={i}
                    onClick={puedeCrear ? () => onClickSlotVacio(vet.id_usuario, horaSlot) : undefined}
                    sx={{
                      height: ALTO_SLOT_PX,
                      borderBottom: 1,
                      borderColor: horaSlot.minute() === 0 ? 'divider' : 'action.selected',
                      cursor: puedeCrear ? 'pointer' : 'default',
                      transition: 'background-color 0.1s',
                      ...(puedeCrear && { '&:hover': { bgcolor: 'action.hover' } }),
                    }}
                  />
                ))}

                <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {(citasPorVeterinario.get(vet.id_usuario) ?? []).map((cita) => {
                    const top = topPx(dayjs(cita.fecha_hora_inicio), horaInicio);
                    const fin = topPx(dayjs(cita.fecha_hora_fin), horaInicio);
                    return (
                      <BloqueCita
                        key={cita.id_cita}
                        cita={cita}
                        top={top}
                        height={fin - top - 2}
                        onClick={() => onClickCita(cita)}
                      />
                    );
                  })}
                </Box>
              </Box>
            </Box>
          ))
        )}

        {esHoy && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: ALTO_ENCABEZADO_PX + topPx(ahora, horaInicio),
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <Box sx={{ position: 'relative', height: 2, bgcolor: 'error.main' }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: ANCHO_GUTTER_PX - 5,
                  top: -4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'error.main',
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
