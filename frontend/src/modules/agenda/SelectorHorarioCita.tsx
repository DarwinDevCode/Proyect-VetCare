import {
  Alert,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import type { Dayjs } from 'dayjs';
import type { Usuario } from '../../types/dominio';
import type { RangoOcupado } from './disponibilidad';

interface Props {
  veterinarios: Usuario[];
  idVeterinario: string;
  onChangeVeterinario: (id: string) => void;
  fecha: Dayjs | null;
  onChangeFecha: (fecha: Dayjs | null) => void;
  hora: Dayjs | null;
  onChangeHora: (hora: Dayjs | null) => void;
  duracionMinutos: number;
  onChangeDuracion: (minutos: number) => void;
  verificando: boolean;
  disponible: boolean | undefined;
  sugerencias: RangoOcupado[];
  errores?: Record<string, string>;
  // RF-014 solo permite cambiar fecha/hora al reprogramar, no el veterinario -- en
  // ese caso CitaDetalleDialog pasa esto en true y el campo se muestra fijo.
  soloLecturaVeterinario?: boolean;
}

function etiquetaRango(rango: RangoOcupado): string {
  return `${rango.inicio.format('HH:mm')}–${rango.fin.format('HH:mm')}`;
}

// RF-011/RF-012/RF-014: campos comunes a crear y reprogramar una cita. Presentacional
// -- la verificacion de disponibilidad (useDisponibilidadCita) vive en cada diálogo
// que lo usa, para que ese mismo estado tambien pueda deshabilitar su boton de guardar.
export function SelectorHorarioCita({
  veterinarios,
  idVeterinario,
  onChangeVeterinario,
  fecha,
  onChangeFecha,
  hora,
  onChangeHora,
  duracionMinutos,
  onChangeDuracion,
  verificando,
  disponible,
  sugerencias,
  errores = {},
  soloLecturaVeterinario = false,
}: Props) {
  const veterinarioActual = veterinarios.find((v) => v.id_usuario === idVeterinario);

  return (
    <Stack spacing={2}>
      {soloLecturaVeterinario ? (
        <TextField
          label="Veterinario"
          fullWidth
          disabled
          value={veterinarioActual ? `${veterinarioActual.nombres} ${veterinarioActual.apellidos}` : ''}
        />
      ) : (
        <TextField
          select
          label="Veterinario"
          required
          fullWidth
          value={idVeterinario}
          error={!!errores.veterinario}
          helperText={errores.veterinario}
          onChange={(e) => onChangeVeterinario(e.target.value)}
        >
          {veterinarios.map((v) => (
            <MenuItem key={v.id_usuario} value={v.id_usuario}>
              {v.nombres} {v.apellidos}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <DatePicker
          label="Fecha"
          value={fecha}
          onChange={onChangeFecha}
          slotProps={{
            textField: {
              fullWidth: true,
              required: true,
              error: !!errores.fecha,
              helperText: errores.fecha,
            },
          }}
        />
        <TimePicker
          label="Hora de inicio"
          value={hora}
          onChange={onChangeHora}
          minutesStep={5}
          slotProps={{
            textField: {
              fullWidth: true,
              required: true,
              error: !!errores.hora,
              helperText: errores.hora,
            },
          }}
        />
        <TextField
          label="Duración (min)"
          type="number"
          required
          fullWidth
          value={duracionMinutos}
          error={!!errores.duracion}
          helperText={errores.duracion}
          slotProps={{ htmlInput: { min: 5, step: 5 } }}
          onChange={(e) => onChangeDuracion(Number(e.target.value))}
        />
      </Stack>

      {verificando && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Verificando disponibilidad…
          </Typography>
        </Stack>
      )}

      {!verificando && disponible === true && (
        <Alert severity="success" sx={{ py: 0 }}>
          Horario disponible.
        </Alert>
      )}

      {!verificando && disponible === false && (
        <Alert severity="warning">
          <Stack spacing={1}>
            <Typography variant="body2">El veterinario ya tiene una cita en ese horario.</Typography>
            {sugerencias.length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2">Próximos horarios libres:</Typography>
                {sugerencias.map((s) => (
                  <Chip
                    key={s.inicio.toISOString()}
                    label={etiquetaRango(s)}
                    size="small"
                    clickable
                    onClick={() => onChangeHora(s.inicio)}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2">
                Sin más huecos disponibles ese día; prueba otra fecha.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
