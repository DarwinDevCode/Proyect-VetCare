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
import {
  cancelarCita,
  confirmarSolicitud,
  listarCoincidenciasListaEspera,
  reprogramarCita,
  type ListaEsperaConPaciente,
} from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  cita: CitaConDetalle | null;
  veterinarios: Usuario[];
  puedeGestionar: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
  // Wiring RF-015 (1i): "agendar" una coincidencia de lista de espera con el cupo
  // que se acaba de liberar. AgendaPage decide que hacer con eso (abrir
  // NuevaCitaDialog prefijado); este dialogo no conoce ese flujo, solo lo ofrece.
  onAgendarDesdeListaEspera?: (entrada: ListaEsperaConPaciente, citaCancelada: CitaConDetalle) => void;
}

const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  solicitada: 'Solicitada',
  programada: 'Programada',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
};

const COLOR_ESTADO: Record<EstadoCita, 'primary' | 'secondary' | 'default' | 'warning'> = {
  solicitada: 'warning',
  programada: 'primary',
  atendida: 'secondary',
  cancelada: 'default',
};

// RF-013 (ver detalle), RF-014 (reprogramar) y RF-015 (cancelar). Solo recepcionista
// gestiona (puedeGestionar); veterinario ve, sin ningun control de edicion.
export function CitaDetalleDialog({
  cita,
  veterinarios,
  puedeGestionar,
  onCerrar,
  onActualizado,
  onAgendarDesdeListaEspera,
}: Props) {
  const [reprogramando, setReprogramando] = useState(false);
  const [confirmandoSolicitud, setConfirmandoSolicitud] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const [fecha, setFecha] = useState<Dayjs | null>(null);
  const [hora, setHora] = useState<Dayjs | null>(null);
  const [duracionMinutos, setDuracionMinutos] = useState(30);
  // RF-043: al confirmar una solicitud (estado='solicitada'), a diferencia de
  // reprogramar, el veterinario todavia no esta asignado -- lo elige Recepcion
  // aqui mismo, por eso necesita su propio estado (reprogramar lo mantiene fijo,
  // soloLecturaVeterinario en SelectorHorarioCita).
  const [idVeterinarioConfirmar, setIdVeterinarioConfirmar] = useState('');

  const [coincidencias, setCoincidencias] = useState<ListaEsperaConPaciente[]>([]);

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!cita) return;
    setFecha(dayjs(cita.fecha_hora_inicio));
    setHora(dayjs(cita.fecha_hora_inicio));
    setDuracionMinutos(cita.duracion_minutos);
    setIdVeterinarioConfirmar('');
    setReprogramando(false);
    setConfirmandoSolicitud(false);
    setConfirmandoCancelar(false);
    setErrorGeneral(null);
    setCoincidencias([]);
  }, [cita]);

  // RF-015 (1i): "liberar cupo a lista de espera" -- en cuanto la cita queda
  // cancelada (aca mismo o ya lo estaba al abrir el detalle), se buscan las
  // entradas pendientes que podrian tomar ese horario. Una 'solicitada' cancelada
  // nunca tuvo un cupo real (id_veterinario null) -- no hay nada que liberar.
  useEffect(() => {
    if (!cita || cita.estado !== 'cancelada' || !cita.id_veterinario || !puedeGestionar) {
      setCoincidencias([]);
      return;
    }
    let vigente = true;
    listarCoincidenciasListaEspera(cita.id_veterinario)
      .then((resultado) => vigente && setCoincidencias(resultado))
      .catch(() => vigente && setCoincidencias([]));
    return () => {
      vigente = false;
    };
  }, [cita, puedeGestionar]);

  // Solo se verifica disponibilidad en vivo mientras se esta reprogramando o
  // confirmando una solicitud -- evita un fetch de fondo cada vez que se abre el
  // detalle solo para consultar, y fuerza una recarga cada vez que se reabre
  // (ver comentario de "activo" en useDisponibilidadCita.ts).
  const { verificando, disponible, sugerencias } = useDisponibilidadCita({
    activo: reprogramando || confirmandoSolicitud,
    idVeterinario: confirmandoSolicitud ? idVeterinarioConfirmar : cita?.id_veterinario ?? '',
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

  // RF-043: confirmar una solicitud del portal -- a diferencia de reprogramar,
  // aqui SI se asigna veterinario (nunca lo tuvo). El UPDATE resultante
  // (estado='programada' + id_veterinario + horario real) es lo que activa el
  // EXCLUDE de solapamiento (RN-004) para esta cita: si el horario elegido ya
  // esta ocupado, falla con 23P01, mismo mensaje ya mapeado en lib/errors.ts.
  async function guardarConfirmacion() {
    if (!fecha || !hora || !idVeterinarioConfirmar) return;
    setGuardando(true);
    setErrorGeneral(null);
    try {
      const inicio = fecha.hour(hora.hour()).minute(hora.minute()).second(0).millisecond(0);
      await confirmarSolicitud(cita!.id_cita, {
        id_veterinario: idVeterinarioConfirmar,
        fecha_hora_inicio: inicio.toISOString(),
        duracion_minutos: duracionMinutos,
      });
      setConfirmandoSolicitud(false);
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
  const puedeConfirmarAhora = puedeGestionar && cita.estado === 'solicitada';

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
              {cita.veterinario
                ? `${cita.veterinario.nombres} ${cita.veterinario.apellidos}`
                : 'Sin veterinario asignado todavía'}
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

          {confirmandoSolicitud && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Confirmar solicitud
                </Typography>
                <SelectorHorarioCita
                  veterinarios={veterinarios}
                  idVeterinario={idVeterinarioConfirmar}
                  onChangeVeterinario={setIdVeterinarioConfirmar}
                  fecha={fecha}
                  onChangeFecha={setFecha}
                  hora={hora}
                  onChangeHora={setHora}
                  duracionMinutos={duracionMinutos}
                  onChangeDuracion={setDuracionMinutos}
                  verificando={verificando}
                  disponible={disponible}
                  sugerencias={sugerencias}
                  errores={!idVeterinarioConfirmar ? { veterinario: 'Selecciona un veterinario.' } : {}}
                />
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
                  <Button onClick={() => setConfirmandoSolicitud(false)} disabled={guardando}>
                    Descartar
                  </Button>
                  <Button
                    variant="contained"
                    onClick={guardarConfirmacion}
                    loading={guardando}
                    disabled={disponible === false || !idVeterinarioConfirmar}
                  >
                    Confirmar cita
                  </Button>
                </Stack>
              </Box>
            </>
          )}

          {reprogramando && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Reprogramar
                </Typography>
                <SelectorHorarioCita
                  veterinarios={veterinarios}
                  idVeterinario={cita.id_veterinario ?? ''}
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
                <Typography variant="body2">
                  {cita.estado === 'solicitada'
                    ? '¿Rechazar esta solicitud? El propietario deberá pedir otra desde el portal.'
                    : '¿Cancelar esta cita? El horario quedará libre.'}
                </Typography>
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

          {coincidencias.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Coincidencias en lista de espera
                </Typography>
                <Stack spacing={1}>
                  {coincidencias.map((entrada) => (
                    <Stack
                      key={entrada.id_lista_espera}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Box>
                        <Typography variant="body2">{entrada.paciente.nombre}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {entrada.paciente.propietario.nombres} {entrada.paciente.propietario.apellidos} —{' '}
                          {entrada.motivo}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => onAgendarDesdeListaEspera?.(entrada, cita)}>
                        Agendar con este cupo
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </>
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
        {puedeConfirmarAhora && !confirmandoSolicitud && !confirmandoCancelar && (
          <>
            <Button color="error" onClick={() => setConfirmandoCancelar(true)}>
              Rechazar solicitud
            </Button>
            <Button variant="contained" onClick={() => setConfirmandoSolicitud(true)}>
              Confirmar
            </Button>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
