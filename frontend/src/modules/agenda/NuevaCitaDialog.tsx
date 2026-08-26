import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { Dayjs } from 'dayjs';
import type { PacienteParaCita, Usuario } from '../../types/dominio';
import { PacienteAutocomplete } from './PacienteAutocomplete';
import { SelectorHorarioCita } from './SelectorHorarioCita';
import { useDisponibilidadCita } from './useDisponibilidadCita';
import { crearCita } from './api';
import { mensajeError } from '../../lib/errors';

interface Prefill {
  idVeterinario?: string;
  hora?: Dayjs;
}

interface Props {
  abierto: boolean;
  veterinarios: Usuario[];
  fechaPorDefecto: Dayjs;
  prefill?: Prefill | null;
  onCerrar: () => void;
  onCreada: () => void;
}

// RF-012: registrar una cita indicando paciente, veterinario, fecha, hora y duracion.
// RF-011: no se registra si la verificacion de disponibilidad resulta negativa.
export function NuevaCitaDialog({
  abierto,
  veterinarios,
  fechaPorDefecto,
  prefill,
  onCerrar,
  onCreada,
}: Props) {
  const [paciente, setPaciente] = useState<PacienteParaCita | null>(null);
  const [idVeterinario, setIdVeterinario] = useState('');
  const [fecha, setFecha] = useState<Dayjs | null>(fechaPorDefecto);
  const [hora, setHora] = useState<Dayjs | null>(null);
  const [duracionMinutos, setDuracionMinutos] = useState(30);
  const [motivo, setMotivo] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setPaciente(null);
    setIdVeterinario(prefill?.idVeterinario ?? '');
    // Si el prefill trae hora (clic en un hueco del grid), esa hora ya lleva
    // el dia correcto -- en la vista semanal, "fechaPorDefecto" es solo el
    // lunes de referencia de la semana, no necesariamente el dia del hueco
    // clicado (puede ser cualquiera de los 7). Sin esto, la cita se crearia
    // con la hora correcta pero en el dia equivocado.
    setFecha(prefill?.hora ?? fechaPorDefecto);
    setHora(prefill?.hora ?? null);
    setDuracionMinutos(30);
    setMotivo('');
    setErrores({});
    setErrorGeneral(null);
    // Se siembra solo al abrir: "prefill"/"fechaPorDefecto" tambien cambian mientras
    // el usuario navega la agenda de fondo con el dialogo cerrado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const { verificando, disponible, sugerencias } = useDisponibilidadCita({
    activo: abierto,
    idVeterinario,
    fecha,
    hora,
    duracionMinutos,
  });

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!paciente) nuevosErrores.paciente = 'Selecciona un paciente.';
    if (!idVeterinario) nuevosErrores.veterinario = 'Obligatorio.';
    if (!fecha) nuevosErrores.fecha = 'Obligatorio.';
    if (!hora) nuevosErrores.hora = 'Obligatorio.';
    if (!duracionMinutos || duracionMinutos <= 0) nuevosErrores.duracion = 'Debe ser mayor a 0.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      const inicio = fecha!.hour(hora!.hour()).minute(hora!.minute()).second(0).millisecond(0);
      await crearCita({
        id_paciente: paciente!.id_paciente,
        id_veterinario: idVeterinario,
        fecha_hora_inicio: inicio.toISOString(),
        duracion_minutos: duracionMinutos,
        motivo: motivo.trim() || null,
      });
      onCreada();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Nueva cita</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <PacienteAutocomplete value={paciente} onChange={setPaciente} error={errores.paciente} />

          <SelectorHorarioCita
            veterinarios={veterinarios}
            idVeterinario={idVeterinario}
            onChangeVeterinario={setIdVeterinario}
            fecha={fecha}
            onChangeFecha={setFecha}
            hora={hora}
            onChangeHora={setHora}
            duracionMinutos={duracionMinutos}
            onChangeDuracion={setDuracionMinutos}
            verificando={verificando}
            disponible={disponible}
            sugerencias={sugerencias}
            errores={errores}
          />

          <TextField
            label="Motivo (opcional)"
            fullWidth
            multiline
            minRows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando} disabled={disponible === false}>
          Registrar cita
        </Button>
      </DialogActions>
    </Dialog>
  );
}
