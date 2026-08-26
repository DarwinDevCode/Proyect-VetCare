import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import type { PacienteConFicha } from '../types/dominio';
import { crearSolicitudCita } from './api';
import { mensajeError } from '../lib/errors';

interface Props {
  abierto: boolean;
  mascotas: PacienteConFicha[];
  fullScreen?: boolean;
  onCerrar: () => void;
  onCreada: () => void;
}

// RF-043: pedir una cita, sin elegir veterinario ni horario exacto (RN-021) --
// solo mascota, motivo y una fecha preferida opcional. Recepcion la confirma
// despues asignando el cupo real (CitaDetalleDialog.tsx).
export function SolicitarCitaDialog({ abierto, mascotas, fullScreen, onCerrar, onCreada }: Props) {
  const [idPaciente, setIdPaciente] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');
  const [fechaPreferida, setFechaPreferida] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setIdPaciente('');
    setMotivo('');
    setFechaPreferida('');
    setErrores({});
    setErrorGeneral(null);
  }, [abierto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!idPaciente) nuevosErrores.paciente = 'Selecciona una mascota.';
    if (!motivo.trim()) nuevosErrores.motivo = 'Cuéntanos brevemente el motivo.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearSolicitudCita({
        id_paciente: idPaciente as number,
        motivo: motivo.trim(),
        fecha_preferida: fechaPreferida || null,
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
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>Solicitar una cita</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Alert severity="info">
            Esto es una solicitud, no una cita confirmada. La clínica te asignará veterinario y horario y podrá
            contactarte para coordinar.
          </Alert>

          <TextField
            select
            label="Mascota"
            required
            fullWidth
            value={idPaciente}
            error={!!errores.paciente}
            helperText={errores.paciente}
            onChange={(e) => setIdPaciente(e.target.value ? Number(e.target.value) : '')}
          >
            {mascotas.map((m) => (
              <MenuItem key={m.id_paciente} value={m.id_paciente}>
                {m.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Motivo"
            required
            fullWidth
            multiline
            minRows={2}
            value={motivo}
            error={!!errores.motivo}
            helperText={errores.motivo}
            slotProps={{ htmlInput: { maxLength: 150 } }}
            onChange={(e) => setMotivo(e.target.value)}
          />

          <TextField
            label="Fecha preferida (opcional)"
            type="date"
            fullWidth
            value={fechaPreferida}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => setFechaPreferida(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Enviar solicitud
        </Button>
      </DialogActions>
    </Dialog>
  );
}
