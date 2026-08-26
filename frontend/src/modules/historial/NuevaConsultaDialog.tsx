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
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { crearConsulta, listarCitasVinculables } from './api';
import { mensajeError } from '../../lib/errors';

interface CitaVinculable {
  id_cita: number;
  fecha_hora_inicio: string;
  motivo: string | null;
  estado: string;
}

interface Props {
  idPaciente: number;
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

const VACIO = {
  motivo: '',
  diagnostico: '',
  hallazgos: '',
  tratamiento: '',
  pesoKg: '',
  temperaturaC: '',
  frecuenciaCardiaca: '',
  frecuenciaRespiratoria: '',
};

// RF-016: motivo/hallazgos/diagnostico/tratamiento se guardan en una sola operacion
// (un insert ya es atomico). RF-017: vincular con la cita que la origino es
// opcional; el selector solo ofrece citas que todavia pueden originar una consulta
// (listarCitasVinculables ya excluye canceladas y las que ya tienen consulta).
export function NuevaConsultaDialog({ idPaciente, abierto, onCerrar, onCreado }: Props) {
  const [form, setForm] = useState(VACIO);
  const [idCita, setIdCita] = useState<number | ''>('');
  const [citasVinculables, setCitasVinculables] = useState<CitaVinculable[]>([]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(VACIO);
    setIdCita('');
    setErrores({});
    setErrorGeneral(null);
    listarCitasVinculables(idPaciente)
      .then(setCitasVinculables)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto, idPaciente]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!form.motivo.trim()) nuevosErrores.motivo = 'Obligatorio.';
    if (!form.diagnostico.trim()) nuevosErrores.diagnostico = 'Obligatorio.';
    if (form.pesoKg.trim() !== '') {
      const peso = Number(form.pesoKg);
      if (Number.isNaN(peso) || peso <= 0) nuevosErrores.pesoKg = 'Debe ser un número mayor a 0.';
    }
    if (form.temperaturaC.trim() !== '') {
      const temperatura = Number(form.temperaturaC);
      if (Number.isNaN(temperatura) || temperatura <= 0) {
        nuevosErrores.temperaturaC = 'Debe ser un número mayor a 0.';
      }
    }
    if (form.frecuenciaCardiaca.trim() !== '') {
      const fc = Number(form.frecuenciaCardiaca);
      if (!Number.isInteger(fc) || fc <= 0) nuevosErrores.frecuenciaCardiaca = 'Debe ser un entero mayor a 0.';
    }
    if (form.frecuenciaRespiratoria.trim() !== '') {
      const fr = Number(form.frecuenciaRespiratoria);
      if (!Number.isInteger(fr) || fr <= 0) nuevosErrores.frecuenciaRespiratoria = 'Debe ser un entero mayor a 0.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearConsulta({
        id_paciente: idPaciente,
        id_cita: idCita || null,
        motivo: form.motivo.trim(),
        hallazgos: form.hallazgos.trim() || null,
        diagnostico: form.diagnostico.trim(),
        tratamiento: form.tratamiento.trim() || null,
        peso_kg: form.pesoKg.trim() ? Number(form.pesoKg) : null,
        temperatura_c: form.temperaturaC.trim() ? Number(form.temperaturaC) : null,
        frecuencia_cardiaca_lpm: form.frecuenciaCardiaca.trim() ? Number(form.frecuenciaCardiaca) : null,
        frecuencia_respiratoria_rpm: form.frecuenciaRespiratoria.trim() ? Number(form.frecuenciaRespiratoria) : null,
      });
      onCreado();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Nueva consulta</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          {citasVinculables.length > 0 && (
            <TextField
              select
              label="Vincular con una cita (opcional)"
              fullWidth
              value={idCita}
              onChange={(e) => setIdCita(e.target.value ? Number(e.target.value) : '')}
            >
              <MenuItem value="">Sin vincular (atención no programada)</MenuItem>
              {citasVinculables.map((cita) => (
                <MenuItem key={cita.id_cita} value={cita.id_cita}>
                  {dayjs(cita.fecha_hora_inicio).format('DD/MM/YYYY HH:mm')}
                  {cita.motivo ? ` — ${cita.motivo}` : ''}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Motivo"
            required
            fullWidth
            multiline
            minRows={2}
            value={form.motivo}
            error={!!errores.motivo}
            helperText={errores.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
          <TextField
            label="Hallazgos (opcional)"
            fullWidth
            multiline
            minRows={2}
            value={form.hallazgos}
            onChange={(e) => setForm((f) => ({ ...f, hallazgos: e.target.value }))}
          />
          <TextField
            label="Diagnóstico"
            required
            fullWidth
            multiline
            minRows={2}
            value={form.diagnostico}
            error={!!errores.diagnostico}
            helperText={errores.diagnostico}
            onChange={(e) => setForm((f) => ({ ...f, diagnostico: e.target.value }))}
          />
          <TextField
            label="Tratamiento (opcional)"
            fullWidth
            multiline
            minRows={2}
            value={form.tratamiento}
            onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
          />
          <TextField
            label="Peso (kg, opcional)"
            type="number"
            fullWidth
            value={form.pesoKg}
            error={!!errores.pesoKg}
            helperText={errores.pesoKg}
            slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            onChange={(e) => setForm((f) => ({ ...f, pesoKg: e.target.value }))}
          />

          <Typography variant="subtitle2">Signos vitales (opcional)</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Temperatura (°C)"
              type="number"
              fullWidth
              value={form.temperaturaC}
              error={!!errores.temperaturaC}
              helperText={errores.temperaturaC}
              slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
              onChange={(e) => setForm((f) => ({ ...f, temperaturaC: e.target.value }))}
            />
            <TextField
              label="Frec. cardíaca (lpm)"
              type="number"
              fullWidth
              value={form.frecuenciaCardiaca}
              error={!!errores.frecuenciaCardiaca}
              helperText={errores.frecuenciaCardiaca}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              onChange={(e) => setForm((f) => ({ ...f, frecuenciaCardiaca: e.target.value }))}
            />
            <TextField
              label="Frec. respiratoria (rpm)"
              type="number"
              fullWidth
              value={form.frecuenciaRespiratoria}
              error={!!errores.frecuenciaRespiratoria}
              helperText={errores.frecuenciaRespiratoria}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              onChange={(e) => setForm((f) => ({ ...f, frecuenciaRespiratoria: e.target.value }))}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar consulta
        </Button>
      </DialogActions>
    </Dialog>
  );
}
