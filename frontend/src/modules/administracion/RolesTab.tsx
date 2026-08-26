import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Rol } from '../../types/dominio';
import { crearRol, listarRoles } from './api';
import { mensajeError } from '../../lib/errors';

const VACIO = { codigo: '', nombre: '', descripcion: '' };

// AD-09/AD-10: consulta de roles y alta de uno nuevo. No hay edicion de
// permisos aqui a proposito (AD-11 del analisis de administracion): los
// permisos de cada rol estan escritos como politicas RLS en migraciones
// versionadas, no en una tabla editable desde la aplicacion -- ver la nota en
// el dialogo de alta.
export function RolesTab() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setRoles(await listarRoles());
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  function abrirDialogo() {
    setForm(VACIO);
    setErrorDialogo(null);
    setDialogoAbierto(true);
  }

  async function guardar() {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setErrorDialogo('Código y nombre son obligatorios.');
      return;
    }
    setErrorDialogo(null);
    setGuardando(true);
    try {
      await crearRol({
        codigo: form.codigo.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
      });
      setDialogoAbierto(false);
      await recargar();
    } catch (err) {
      setErrorDialogo(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirDialogo}>
          Nuevo rol
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripción</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando &&
              roles.map((rol) => (
                <TableRow key={rol.id_rol} hover>
                  <TableCell>
                    <code>{rol.codigo}</code>
                  </TableCell>
                  <TableCell>{rol.nombre}</TableCell>
                  <TableCell>{rol.descripcion ?? '—'}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogoAbierto} onClose={() => setDialogoAbierto(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo rol</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {errorDialogo && <Alert severity="error">{errorDialogo}</Alert>}
            <Alert severity="warning">
              Un rol nuevo queda en el catálogo sin ningún permiso real hasta que se agreguen políticas de acceso
              para él en una migración de base de datos — esta pantalla no las crea.
            </Alert>
            <TextField
              label="Código"
              required
              fullWidth
              placeholder="ej. asistente"
              helperText="Identificador interno en minúsculas, sin espacios; se usa tal cual en las políticas de acceso."
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            />
            <TextField
              label="Nombre"
              required
              fullWidth
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <TextField
              label="Descripción"
              fullWidth
              multiline
              minRows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogoAbierto(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardar} loading={guardando}>
            Crear rol
          </Button>
        </DialogActions>
      </Dialog>

      {!cargando && roles.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          No hay roles registrados.
        </Typography>
      )}
    </Box>
  );
}
