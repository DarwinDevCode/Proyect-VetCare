import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { crearExamen } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  idPaciente: number;
  // Definido cuando se abre "dentro de una consulta" (RF-019); undefined cuando se
  // abre de forma independiente desde el boton general de la pagina.
  idConsulta?: number;
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

// RF-019: registrar el examen antes de tener el resultado; se completa despues
// (CompletarExamenDialog.tsx) sin crear un registro nuevo.
export function NuevoExamenDialog({ idPaciente, idConsulta, abierto, onCerrar, onCreado }: Props) {
  const [tipoExamen, setTipoExamen] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTipoExamen('');
    setErrores({});
    setErrorGeneral(null);
  }, [abierto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!tipoExamen.trim()) nuevosErrores.tipoExamen = 'Obligatorio.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearExamen({
        id_paciente: idPaciente,
        id_consulta: idConsulta ?? null,
        tipo_examen: tipoExamen.trim(),
        observacion: null,
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
      <DialogTitle>Nuevo examen de laboratorio</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <TextField
            label="Tipo de examen"
            required
            fullWidth
            placeholder="ej. Hemograma completo, Perfil renal"
            value={tipoExamen}
            error={!!errores.tipoExamen}
            helperText={errores.tipoExamen}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            onChange={(e) => setTipoExamen(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Solicitar examen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
