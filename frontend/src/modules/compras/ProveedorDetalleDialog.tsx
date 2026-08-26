import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { Proveedor } from '../../types/dominio';
import { actualizarProveedor } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  proveedor: Proveedor | null;
  onCerrar: () => void;
  onActualizado: () => void;
}

// RF-036: editar los datos de un proveedor, incluida su reactivación/desactivación
// -- sin borrado físico (RF-033), igual que producto en el Módulo 4.
export function ProveedorDetalleDialog({ proveedor, onCerrar, onActualizado }: Props) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    identificacion: '',
    telefono: '',
    correo: '',
    direccion: '',
    activo: true,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!proveedor) return;
    setForm({
      nombre: proveedor.nombre,
      identificacion: proveedor.identificacion,
      telefono: proveedor.telefono,
      correo: proveedor.correo ?? '',
      direccion: proveedor.direccion ?? '',
      activo: proveedor.activo,
    });
    setEditando(false);
    setErrorGeneral(null);
  }, [proveedor]);

  if (!proveedor) return null;

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
      await actualizarProveedor(proveedor!.id_proveedor, {
        nombre: form.nombre.trim(),
        identificacion: form.identificacion.trim(),
        telefono: form.telefono.trim(),
        correo: form.correo.trim() || null,
        direccion: form.direccion.trim() || null,
        activo: form.activo,
      });
      setEditando(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={!!proveedor} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        {proveedor.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}
          {!proveedor.activo && <Chip label="Inactivo" size="small" sx={{ alignSelf: 'flex-start' }} />}

          {editando ? (
            <>
              <TextField
                label="Nombre / Razón social"
                fullWidth
                value={form.nombre}
                error={!!errores.nombre}
                helperText={errores.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="RUC / Identificación"
                  fullWidth
                  value={form.identificacion}
                  error={!!errores.identificacion}
                  helperText={errores.identificacion}
                  onChange={(e) => setForm((f) => ({ ...f, identificacion: e.target.value }))}
                />
                <TextField
                  label="Teléfono"
                  fullWidth
                  value={form.telefono}
                  error={!!errores.telefono}
                  helperText={errores.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Correo"
                  fullWidth
                  value={form.correo}
                  onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                />
                <TextField
                  label="Dirección"
                  fullWidth
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  />
                }
                label={form.activo ? 'Activo' : 'Inactivo'}
              />
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => setEditando(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button variant="contained" onClick={guardar} loading={guardando}>
                  Guardar
                </Button>
              </Stack>
            </>
          ) : (
            <Stack spacing={0.5}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Datos del proveedor</Typography>
                <IconButton size="small" onClick={() => setEditando(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Typography variant="body2">RUC: {proveedor.identificacion}</Typography>
              <Typography variant="body2" color="text.secondary">
                Tel: {proveedor.telefono}
              </Typography>
              {proveedor.correo && (
                <Typography variant="body2" color="text.secondary">
                  {proveedor.correo}
                </Typography>
              )}
              {proveedor.direccion && (
                <Typography variant="body2" color="text.secondary">
                  {proveedor.direccion}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
