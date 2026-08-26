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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { FranjaPreferida, PacienteParaCita, Usuario } from '../../types/dominio';
import { PacienteAutocomplete } from './PacienteAutocomplete';
import { crearListaEspera } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  veterinarios: Usuario[];
  onCerrar: () => void;
  onCreada: () => void;
}

// RF-034: registrar una entrada de lista de espera -- paciente y motivo son lo
// unico obligatorio; veterinario/fecha/franja son preferencias del propietario,
// no un cupo real todavia (eso es justamente lo que la distingue de una cita).
export function NuevaListaEsperaDialog({ abierto, veterinarios, onCerrar, onCreada }: Props) {
  const [paciente, setPaciente] = useState<PacienteParaCita | null>(null);
  const [idVeterinario, setIdVeterinario] = useState('');
  const [fechaPreferida, setFechaPreferida] = useState('');
  const [franjaPreferida, setFranjaPreferida] = useState<FranjaPreferida | ''>('');
  const [motivo, setMotivo] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setPaciente(null);
    setIdVeterinario('');
    setFechaPreferida('');
    setFranjaPreferida('');
    setMotivo('');
    setErrores({});
    setErrorGeneral(null);
  }, [abierto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!paciente) nuevosErrores.paciente = 'Selecciona un paciente.';
    if (!motivo.trim()) nuevosErrores.motivo = 'Obligatorio.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearListaEspera({
        id_paciente: paciente!.id_paciente,
        id_veterinario: idVeterinario || null,
        fecha_preferida: fechaPreferida || null,
        franja_preferida: franjaPreferida || null,
        motivo: motivo.trim(),
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
      <DialogTitle>Nueva entrada en lista de espera</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <PacienteAutocomplete value={paciente} onChange={setPaciente} error={errores.paciente} />

          <TextField
            select
            label="Veterinario preferido (opcional)"
            fullWidth
            value={idVeterinario}
            onChange={(e) => setIdVeterinario(e.target.value)}
          >
            <MenuItem value="">Cualquiera</MenuItem>
            {veterinarios.map((v) => (
              <MenuItem key={v.id_usuario} value={v.id_usuario}>
                {v.nombres} {v.apellidos}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fecha preferida (opcional)"
              type="date"
              fullWidth
              value={fechaPreferida}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => setFechaPreferida(e.target.value)}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={franjaPreferida}
              onChange={(_, val) => setFranjaPreferida(val ?? '')}
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="manana">Mañana</ToggleButton>
              <ToggleButton value="tarde">Tarde</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <TextField
            label="Motivo"
            required
            fullWidth
            multiline
            minRows={2}
            value={motivo}
            error={!!errores.motivo}
            helperText={errores.motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
