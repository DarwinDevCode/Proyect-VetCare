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
import { crearVacunacion, listarProductosVacuna, type ProductoVacuna } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  idPaciente: number;
  // Definido cuando se abre "dentro de una consulta" (RF-018); undefined cuando se
  // abre de forma independiente desde el boton general de la pagina.
  idConsulta?: number;
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

// RF-018: registrar la aplicacion de una vacuna, indicando producto y dosis. El
// descuento de inventario lo dispara automaticamente el trigger ya existente al
// insertar -- este dialogo nunca toca movimiento_inventario directamente.
export function NuevaVacunacionDialog({ idPaciente, idConsulta, abierto, onCerrar, onCreado }: Props) {
  const [productos, setProductos] = useState<ProductoVacuna[]>([]);
  const [idProducto, setIdProducto] = useState<number | ''>('');
  const [dosis, setDosis] = useState('');
  const [lote, setLote] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setIdProducto('');
    setDosis('');
    setLote('');
    setErrores({});
    setErrorGeneral(null);
    listarProductosVacuna()
      .then(setProductos)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!idProducto) nuevosErrores.producto = 'Selecciona una vacuna.';
    const dosisNum = Number(dosis);
    if (dosis.trim() === '' || Number.isNaN(dosisNum) || dosisNum <= 0) {
      nuevosErrores.dosis = 'Debe ser un número mayor a 0.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearVacunacion({
        id_paciente: idPaciente,
        id_producto: idProducto as number,
        id_consulta: idConsulta ?? null,
        dosis: Number(dosis),
        lote: lote.trim() || null,
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
      <DialogTitle>Nueva vacunación</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <TextField
            select
            label="Vacuna"
            required
            fullWidth
            value={idProducto}
            error={!!errores.producto}
            helperText={errores.producto || (productos.length === 0 ? 'No hay vacunas activas en el catálogo.' : '')}
            onChange={(e) => setIdProducto(e.target.value ? Number(e.target.value) : '')}
          >
            {productos.map((p) => (
              <MenuItem key={p.id_producto} value={p.id_producto}>
                {p.nombre}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Dosis"
              type="number"
              required
              fullWidth
              value={dosis}
              error={!!errores.dosis}
              helperText={errores.dosis}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              onChange={(e) => setDosis(e.target.value)}
            />
            <TextField
              label="Lote (opcional)"
              fullWidth
              value={lote}
              slotProps={{ htmlInput: { maxLength: 30 } }}
              onChange={(e) => setLote(e.target.value)}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar vacunación
        </Button>
      </DialogActions>
    </Dialog>
  );
}
