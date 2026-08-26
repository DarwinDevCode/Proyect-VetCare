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
import type { Rol } from '../../types/dominio';
import { crearUsuario, listarRoles } from './api';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

const VACIO = { nombres: '', apellidos: '', correo: '', password: '' };

// AD-01: alta de cuenta de personal. Reemplaza el procedimiento manual con
// curl contra la API admin de GoTrue que documenta CLAUDE.md #7 -- la Edge
// Function admin-usuarios hace exactamente esos mismos dos pasos (crear en
// auth.users, vincular el id devuelto a un rol en public.usuario) pero desde
// la aplicacion y verificando ella misma que quien llama es Administrador.
export function NuevoUsuarioDialog({ abierto, onCerrar, onCreado }: Props) {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [idRol, setIdRol] = useState<number | ''>('');
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setForm(VACIO);
    setIdRol('');
    setErrores({});
    setErrorGeneral(null);
    listarRoles()
      .then(setRoles)
      .catch((err) => setErrorGeneral(err instanceof Error ? err.message : 'No se pudieron cargar los roles.'));
  }, [abierto]);

  function cerrar() {
    onCerrar();
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!form.nombres.trim()) nuevosErrores.nombres = 'Obligatorio.';
    if (!form.apellidos.trim()) nuevosErrores.apellidos = 'Obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) nuevosErrores.correo = 'Correo inválido.';
    if (form.password.length < 6) nuevosErrores.password = 'Mínimo 6 caracteres.';
    if (!idRol) nuevosErrores.idRol = 'Selecciona un rol.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;
    setGuardando(true);
    try {
      await crearUsuario({
        correo: form.correo.trim(),
        password: form.password,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        idRol: idRol as number,
      });
      onCreado();
      cerrar();
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Nuevo usuario</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nombres"
              required
              fullWidth
              value={form.nombres}
              error={!!errores.nombres}
              helperText={errores.nombres}
              onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
            />
            <TextField
              label="Apellidos"
              required
              fullWidth
              value={form.apellidos}
              error={!!errores.apellidos}
              helperText={errores.apellidos}
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
            />
          </Stack>

          <TextField
            label="Correo"
            type="email"
            required
            fullWidth
            value={form.correo}
            error={!!errores.correo}
            helperText={errores.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
          />

          <TextField
            label="Contraseña temporal"
            type="text"
            required
            fullWidth
            helperText={errores.password || 'Se comparte con el empleado por un canal seguro; puede cambiarla después.'}
            error={!!errores.password}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />

          <TextField
            select
            label="Rol"
            required
            fullWidth
            value={idRol}
            error={!!errores.idRol}
            helperText={errores.idRol}
            onChange={(e) => setIdRol(e.target.value ? Number(e.target.value) : '')}
          >
            {roles.map((rol) => (
              <MenuItem key={rol.id_rol} value={rol.id_rol}>
                {rol.nombre}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Crear usuario
        </Button>
      </DialogActions>
    </Dialog>
  );
}
