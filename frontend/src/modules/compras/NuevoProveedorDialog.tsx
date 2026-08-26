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
} from '@mui/material';
import { crearProveedor } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

const VACIO = { nombre: '', identificacion: '', telefono: '', correo: '', direccion: '' };

// RF-036: registrar un proveedor con lo mínimo para poder emitirle una orden de
// compra después (RF-037) -- identificación, teléfono. Correo/dirección opcionales.
export function NuevoProveedorDialog({ abierto, onCerrar, onCreado }: Props) {
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function reiniciar() {
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
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Obligatorio.';
    if (!form.identificacion.trim()) nuevosErrores.identificacion = 'Obligatorio.';
    if (!form.telefono.trim()) nuevosErrores.telefono = 'Obligatorio.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearProveedor({
        nombre: form.nombre.trim(),
        identificacion: form.identificacion.trim(),
        telefono: form.telefono.trim(),
        correo: form.correo.trim() || null,
        direccion: form.direccion.trim() || null,
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
      <DialogTitle>Registrar nuevo proveedor</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <TextField
            label="Nombre / Razón social"
            required
            fullWidth
            value={form.nombre}
            error={!!errores.nombre}
            helperText={errores.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="RUC / Identificación"
              required
              fullWidth
              value={form.identificacion}
              error={!!errores.identificacion}
              helperText={errores.identificacion}
              onChange={(e) => setForm((f) => ({ ...f, identificacion: e.target.value }))}
            />
            <TextField
              label="Teléfono"
              required
              fullWidth
              value={form.telefono}
              error={!!errores.telefono}
              helperText={errores.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Correo (opcional)"
              fullWidth
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            />
            <TextField
              label="Dirección (opcional)"
              fullWidth
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar proveedor
        </Button>
      </DialogActions>
    </Dialog>
  );
}
