import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import type { CitaConDetalle } from '../../types/dominio';
import { BloqueCita } from './BloqueCita';
import { HORA_FIN_ATENCION, HORA_INICIO_ATENCION } from './disponibilidad';

const ALTO_SLOT_PX = 56;
const MINUTOS_POR_SLOT = 60;
const ANCHO_GUTTER_PX = 64;
const ALTO_ENCABEZADO_PX = 52;
// Piso de ancho por columna antes de que el contenedor empiece a scrollear
// horizontalmente (overflow: auto mas abajo) -- las columnas crecen con
// flex:1 para aprovechar todo el ancho disponible en pantallas anchas, pero
// sin este piso 7 columnas se aplastarian demasiado en una pantalla angosta.
const ANCHO_MINIMO_DIA_PX = 130;

const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

interface Props {
  inicioSemana: Dayjs;
  citas: CitaConDetalle[];
  onClickSlotVacio: (dia: Dayjs, hora: Dayjs) => void;
  onClickCita: (cita: CitaConDetalle) => void;
  puedeCrear: boolean;
}

function topPx(momento: Dayjs, horaInicio: number): number {
  const minutos = (momento.hour() - horaInicio) * 60 + momento.minute();
  return (minutos / MINUTOS_POR_SLOT) * ALTO_SLOT_PX;
}

// RF-013 ("filtrando por periodo"): agenda de un veterinario a lo largo de una
// semana, dia x hora -- complementa a AgendaGrid (dia x veterinario), que sigue
// siendo la vista para comparar varios veterinarios en el mismo momento. Aqui el
// eje cambia porque la pregunta que responde es distinta: "cuando tiene un hueco
// esta semana Dr. Vera", no "quien esta libre ahora mismo".
//
// Reutiliza BloqueCita tal cual: el componente ya es agnostico de que columna
// representa (dia o veterinario), solo necesita top/height en pixeles.
export function AgendaSemanal({ inicioSemana, citas, onClickSlotVacio, onClickCita, puedeCrear }: Props) {
  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => inicioSemana.add(i, 'day')),
    [inicioSemana],
  );

  const horas = useMemo(
    () => Array.from({ length: HORA_FIN_ATENCION - HORA_INICIO_ATENCION }, (_, i) => HORA_INICIO_ATENCION + i),
    [],
  );
  const alturaTotal = horas.length * ALTO_SLOT_PX;

  const citasPorDia = useMemo(() => {
    const mapa = new Map<string, CitaConDetalle[]>();
    for (const c of citas) {
      const clave = dayjs(c.fecha_hora_inicio).format('YYYY-MM-DD');
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(c);
    }
    return mapa;
  }, [citas]);

  const hoy = dayjs().format('YYYY-MM-DD');

  return (
    <Box
      sx={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 220px)',
        minHeight: 480,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      {/* width:100% + minWidth:'fit-content' -- las 7 columnas (flex:1 mas
          abajo) se reparten todo el ancho disponible en pantallas anchas;
          minWidth (del contenedor y de cada columna) es el piso que hace que
          esta fila crezca mas alla del 100% y dispare el overflow:auto de
          arriba si el ancho real no alcanza para las 7 sin aplastarlas. */}
      <Box sx={{ display: 'flex', width: '100%', minWidth: 'fit-content' }}>
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
                sx={{ position: 'absolute', top: (h - HORA_INICIO_ATENCION) * ALTO_SLOT_PX - 7, right: 6 }}
              >
                {String(h).padStart(2, '0')}:00
              </Typography>
            ))}
          </Box>
        </Box>

        {dias.map((dia, i) => {
          const clave = dia.format('YYYY-MM-DD');
          const esHoy = clave === hoy;
          return (
            <Box key={clave} sx={{ flex: 1, minWidth: ANCHO_MINIMO_DIA_PX, borderRight: 1, borderColor: 'divider' }}>
              <Box
                sx={{
                  height: ALTO_ENCABEZADO_PX,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: esHoy ? 'primary.50' : undefined,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  {DIAS_SEMANA[i]}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: esHoy ? 'primary.main' : undefined }}>
                  {dia.format('D')}
                </Typography>
              </Box>

              <Box sx={{ position: 'relative', height: alturaTotal }}>
                {horas.map((h) => (
                  <Box
                    key={h}
                    onClick={puedeCrear ? () => onClickSlotVacio(dia, dia.hour(h).minute(0)) : undefined}
                    sx={{
                      height: ALTO_SLOT_PX,
                      borderBottom: 1,
                      borderColor: 'divider',
                      cursor: puedeCrear ? 'pointer' : 'default',
                      ...(puedeCrear && { '&:hover': { bgcolor: 'action.hover' } }),
                    }}
                  />
                ))}

                <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {(citasPorDia.get(clave) ?? []).map((cita) => {
                    const top = topPx(dayjs(cita.fecha_hora_inicio), HORA_INICIO_ATENCION);
                    const fin = topPx(dayjs(cita.fecha_hora_fin), HORA_INICIO_ATENCION);
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
          );
        })}
      </Box>
    </Box>
  );
}
