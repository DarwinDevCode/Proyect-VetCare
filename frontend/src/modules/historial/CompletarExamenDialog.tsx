import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { completarExamen } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  idExamen: number | null;
  // Fecha de solicitud del examen, para no dejar elegir un resultado anterior a
  // ella (el CHECK de la base ya lo garantiza; se repite en el cliente para dar el
  // error antes del round-trip).
  fechaSolicitud: string | null;
  abierto: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

// RF-019 / RN-007: unica excepcion a la inmutabilidad de un registro clinico --
// completar el resultado de un examen ya existente, sin crear uno nuevo.
export function CompletarExamenDialog({ idExamen, fechaSolicitud, abierto, onCerrar, onActualizado }: Props) {
  const [resultado, setResultado] = useState('');
  const [fechaResultado, setFechaResultado] = useState<Dayjs | null>(dayjs());

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setResultado('');
    setFechaResultado(dayjs());
    setErrores({});
    setErrorGeneral(null);
  }, [abierto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!resultado.trim()) nuevosErrores.resultado = 'Obligatorio.';
    if (!fechaResultado) {
      nuevosErrores.fechaResultado = 'Obligatorio.';
    } else if (fechaSolicitud && fechaResultado.isBefore(dayjs(fechaSolicitud), 'day')) {
      nuevosErrores.fechaResultado = 'No puede ser anterior a la fecha de solicitud.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    if (idExamen === null) return;
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await completarExamen(idExamen, {
        resultado: resultado.trim(),
        fecha_resultado: fechaResultado!.format('YYYY-MM-DD'),
      });
      onActualizado();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto && idExamen !== null} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Completar resultado del examen</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <DatePicker
            label="Fecha del resultado"
            value={fechaResultado}
            onChange={setFechaResultado}
            minDate={fechaSolicitud ? dayjs(fechaSolicitud) : undefined}
            maxDate={dayjs()}
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                error: !!errores.fechaResultado,
                helperText: errores.fechaResultado,
              },
            }}
          />
          <TextField
            label="Resultado"
            required
            fullWidth
            multiline
            minRows={3}
            value={resultado}
            error={!!errores.resultado}
            helperText={errores.resultado}
            onChange={(e) => setResultado(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Guardar resultado
        </Button>
      </DialogActions>
    </Dialog>
  );
}
