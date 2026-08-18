import { Box, Tooltip, Typography } from '@mui/material';
import dayjs from 'dayjs';
import type { CitaConDetalle } from '../../types/dominio';

interface Props {
  cita: CitaConDetalle;
  top: number;
  height: number;
  onClick: () => void;
}

const ESTILO_POR_ESTADO: Record<CitaConDetalle['estado'], object> = {
  programada: { bgcolor: 'primary.main', color: 'primary.contrastText' },
  atendida: { bgcolor: 'secondary.main', color: 'secondary.contrastText' },
  // RN-005: una cita cancelada libera su horario -- se pinta como informativa/fantasma,
  // nunca con la misma fuerza visual que una cita activa.
  cancelada: {
    bgcolor: 'action.disabledBackground',
    color: 'text.secondary',
    textDecoration: 'line-through',
    border: '1px dashed',
    borderColor: 'grey.500',
  },
};

// RF-013: bloque de una cita dentro de AgendaGrid, posicionado por hora/duracion.
export function BloqueCita({ cita, top, height, onClick }: Props) {
  const rango = `${dayjs(cita.fecha_hora_inicio).format('HH:mm')}–${dayjs(cita.fecha_hora_fin).format('HH:mm')}`;
  const detalle = `${cita.paciente.nombre} (${cita.paciente.propietario.nombres} ${cita.paciente.propietario.apellidos})`;

  return (
    <Tooltip
      title={
        <>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
            {rango} · {detalle}
          </Typography>
          {cita.motivo && <Typography variant="caption">{cita.motivo}</Typography>}
        </>
      }
    >
      <Box
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        sx={{
          position: 'absolute',
          left: 4,
          right: 4,
          top,
          height: Math.max(height, 20),
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          overflow: 'hidden',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: 1,
          '&:hover': { boxShadow: 3 },
          ...ESTILO_POR_ESTADO[cita.estado],
        }}
      >
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.2 }} noWrap>
          {cita.paciente.nombre}
        </Typography>
        {height > 32 && (
          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2, opacity: 0.9 }} noWrap>
            {rango}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
