import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { TipoProducto } from '../../types/dominio';
import { crearProducto } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

const VACIO = {
  codigo: '',
  nombre: '',
  presentacion: '',
  unidadMedida: '',
  nivelMinimo: '',
  precioUnitario: '',
  intervaloDias: '',
};

// RF-021: registrar medicamentos, insumos y vacunas, indicando unidad de medida,
// precio unitario y nivel minimo de existencias. No pide existencia inicial: esa se
// establece despues con un movimiento de tipo ingreso (ProductoDetalleDialog),
// coherente con que existencia_actual la mantiene siempre el trigger.
export function NuevoProductoDialog({ abierto, onCerrar, onCreado }: Props) {
  const [tipo, setTipo] = useState<TipoProducto | ''>('');
  const [form, setForm] = useState(VACIO);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function reiniciar() {
    setTipo('');
    setForm(VACIO);
    setErrores({});
    setErrorGeneral(null);
  }

  function cerrar() {
    reiniciar();
    onCerrar();
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!form.codigo.trim()) nuevosErrores.codigo = 'Obligatorio.';
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Obligatorio.';
    if (!tipo) nuevosErrores.tipo = 'Selecciona un tipo.';
    if (!form.unidadMedida.trim()) nuevosErrores.unidadMedida = 'Obligatorio.';

    const nivelMinimo = Number(form.nivelMinimo);
    if (form.nivelMinimo.trim() === '' || Number.isNaN(nivelMinimo) || nivelMinimo < 0) {
      nuevosErrores.nivelMinimo = 'Debe ser un número mayor o igual a 0.';
    }
    const precioUnitario = Number(form.precioUnitario);
    if (form.precioUnitario.trim() === '' || Number.isNaN(precioUnitario) || precioUnitario < 0) {
      nuevosErrores.precioUnitario = 'Debe ser un número mayor o igual a 0.';
    }
    if (form.intervaloDias.trim() !== '') {
      const intervalo = Number(form.intervaloDias);
      if (!Number.isInteger(intervalo) || intervalo <= 0) {
        nuevosErrores.intervaloDias = 'Debe ser un número entero mayor a 0.';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearProducto({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        tipo: tipo as TipoProducto,
        presentacion: form.presentacion.trim() || null,
        unidad_medida: form.unidadMedida.trim(),
        nivel_minimo: Number(form.nivelMinimo),
        precio_unitario: Number(form.precioUnitario),
        intervalo_dias: tipo === 'vacuna' && form.intervaloDias.trim() ? Number(form.intervaloDias) : null,
      });
      onCreado();
      cerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar nuevo producto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Código"
              required
              fullWidth
              value={form.codigo}
              error={!!errores.codigo}
              helperText={errores.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            />
            <TextField
              label="Nombre"
              required
              fullWidth
              value={form.nombre}
              error={!!errores.nombre}
              helperText={errores.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="body2" color={errores.tipo ? 'error' : 'text.secondary'}>
              Tipo *
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={tipo}
              onChange={(_, val) => val && setTipo(val)}
            >
              <ToggleButton value="medicamento">Medicamento</ToggleButton>
              <ToggleButton value="insumo">Insumo</ToggleButton>
              <ToggleButton value="vacuna">Vacuna</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Unidad de medida"
              required
              fullWidth
              placeholder="ej. ml, tableta, unidad"
              value={form.unidadMedida}
              error={!!errores.unidadMedida}
              helperText={errores.unidadMedida}
              onChange={(e) => setForm((f) => ({ ...f, unidadMedida: e.target.value }))}
            />
            <TextField
              label="Presentación (opcional)"
              fullWidth
              placeholder="ej. frasco 250ml"
              value={form.presentacion}
              onChange={(e) => setForm((f) => ({ ...f, presentacion: e.target.value }))}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nivel mínimo"
              type="number"
              required
              fullWidth
              value={form.nivelMinimo}
              error={!!errores.nivelMinimo}
              helperText={errores.nivelMinimo}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              onChange={(e) => setForm((f) => ({ ...f, nivelMinimo: e.target.value }))}
            />
            <TextField
              label="Precio unitario"
              type="number"
              required
              fullWidth
              value={form.precioUnitario}
              error={!!errores.precioUnitario}
              helperText={errores.precioUnitario}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))}
            />
          </Stack>

          {tipo === 'vacuna' && (
            <TextField
              label="Intervalo entre dosis (días, opcional)"
              type="number"
              fullWidth
              placeholder="ej. 365 para refuerzo anual"
              value={form.intervaloDias}
              error={!!errores.intervaloDias}
              helperText={errores.intervaloDias || 'Se usa para sugerir la próxima fecha de aplicación (RF-041).'}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              onChange={(e) => setForm((f) => ({ ...f, intervaloDias: e.target.value }))}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar producto
        </Button>
      </DialogActions>
    </Dialog>
  );
}
