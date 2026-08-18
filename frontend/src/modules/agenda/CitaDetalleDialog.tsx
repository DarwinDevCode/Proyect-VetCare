import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs, { type Dayjs } from 'dayjs';
import type { CitaConDetalle, EstadoCita, Usuario } from '../../types/dominio';
import { SelectorHorarioCita } from './SelectorHorarioCita';
import { useDisponibilidadCita } from './useDisponibilidadCita';
import { cancelarCita, reprogramarCita } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  cita: CitaConDetalle | null;
  veterinarios: Usuario[];
  puedeGestionar: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  programada: 'Programada',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
};

const COLOR_ESTADO: Record<EstadoCita, 'primary' | 'secondary' | 'default'> = {
  programada: 'primary',
  atendida: 'secondary',
  cancelada: 'default',
};

// RF-013 (ver detalle), RF-014 (reprogramar) y RF-015 (cancelar). Solo recepcionista
// gestiona (puedeGestionar); veterinario ve, sin ningun control de edicion.
export function CitaDetalleDialog({ cita, veterinarios, puedeGestionar, onCerrar, onActualizado }: Props) {
  const [reprogramando, setReprogramando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const [fecha, setFecha] = useState<Dayjs | null>(null);
  const [hora, setHora] = useState<Dayjs | null>(null);
  const [duracionMinutos, setDuracionMinutos] = useState(30);

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!cita) return;
    setFecha(dayjs(cita.fecha_hora_inicio));
    setHora(dayjs(cita.fecha_hora_inicio));
    setDuracionMinutos(cita.duracion_minutos);
    setReprogramando(false);
    setConfirmandoCancelar(false);
    setErrorGeneral(null);
  }, [cita]);

  // Solo se verifica disponibilidad en vivo mientras se esta reprogramando -- evita
  // un fetch de fondo cada vez que se abre el detalle solo para consultar, y fuerza
  // una recarga cada vez que se reabre "Reprogramar" aunque sea para el mismo
  // veterinario/dia (ver comentario de "activo" en useDisponibilidadCita.ts).
  const { verificando, disponible, sugerencias } = useDisponibilidadCita({
    activo: reprogramando,
    idVeterinario: cita?.id_veterinario ?? '',
    fecha,
    hora,
    duracionMinutos,
    idCitaExcluir: cita?.id_cita,
  });

  if (!cita) return null;

  async function guardarReprogramacion() {
    if (!fecha || !hora) return;
    setGuardando(true);
    setErrorGeneral(null);
    try {
      const inicio = fecha.hour(hora.hour()).minute(hora.minute()).second(0).millisecond(0);
      await reprogramarCita(cita!.id_cita, {
        fecha_hora_inicio: inicio.toISOString(),
        duracion_minutos: duracionMinutos,
      });
      setReprogramando(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarCancelacion() {
    setGuardando(true);
    setErrorGeneral(null);
    try {
      await cancelarCita(cita!.id_cita);
      setConfirmandoCancelar(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  const puedeGestionarAhora = puedeGestionar && cita.estado === 'programada';

  return (
    <Dialog open={!!cita} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Cita de {cita.paciente.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Box>
            <Chip
              label={ETIQUETA_ESTADO[cita.estado]}
              color={COLOR_ESTADO[cita.estado]}
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="body2">
              {dayjs(cita.fecha_hora_inicio).format('DD/MM/YYYY')} ·{' '}
              {dayjs(cita.fecha_hora_inicio).format('HH:mm')}–{dayjs(cita.fecha_hora_fin).format('HH:mm')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cita.veterinario.nombres} {cita.veterinario.apellidos}
            </Typography>
            {cita.motivo && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {cita.motivo}
              </Typography>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Propietario
            </Typography>
            <Typography variant="body2">
              {cita.paciente.propietario.nombres} {cita.paciente.propietario.apellidos}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tel: {cita.paciente.propietario.telefono}
            </Typography>
          </Box>

          {reprogramando && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Reprogramar
                </Typography>
                <SelectorHorarioCita
                  veterinarios={veterinarios}
                  idVeterinario={cita.id_veterinario}
                  onChangeVeterinario={() => {}}
                  soloLecturaVeterinario
                  fecha={fecha}
                  onChangeFecha={setFecha}
                  hora={hora}
                  onChangeHora={setHora}
                  duracionMinutos={duracionMinutos}
                  onChangeDuracion={setDuracionMinutos}
                  verificando={verificando}
                  disponible={disponible}
                  sugerencias={sugerencias}
                />
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
                  <Button onClick={() => setReprogramando(false)} disabled={guardando}>
                    Descartar
                  </Button>
                  <Button
                    variant="contained"
                    onClick={guardarReprogramacion}
                    loading={guardando}
                    disabled={disponible === false}
                  >
                    Guardar cambios
                  </Button>
                </Stack>
              </Box>
            </>
          )}

          {confirmandoCancelar && (
            <Alert severity="warning">
              <Stack spacing={1}>
                <Typography variant="body2">¿Cancelar esta cita? El horario quedará libre.</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setConfirmandoCancelar(false)} disabled={guardando}>
                    No
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    onClick={confirmarCancelacion}
                    loading={guardando}
                  >
                    Sí, cancelar
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {puedeGestionarAhora && !reprogramando && !confirmandoCancelar && (
          <>
            <Button color="error" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar cita
            </Button>
            <Button onClick={() => setReprogramando(true)}>Reprogramar</Button>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
