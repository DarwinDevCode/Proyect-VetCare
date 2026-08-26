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
import type { Rol, UsuarioConRol } from '../../types/dominio';
import { actualizarUsuario, listarRoles } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  usuario: UsuarioConRol | null;
  onCerrar: () => void;
  onActualizado: () => void;
}

// AD-02/AD-12: editar nombre y reasignar rol de una cuenta existente. Es un
// UPDATE normal via PostgREST (RLS ya restringe esto a Administrador) -- a
// diferencia de crear/activar/restablecer, no necesita la Edge Function
// porque no toca auth.users. fn_proteger_ultimo_administrador (trigger)
// rechaza reasignar el rol del unico Administrador activo.
export function EditarUsuarioDialog({ usuario, onCerrar, onActualizado }: Props) {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [idRol, setIdRol] = useState<number | ''>('');
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setNombres(usuario.nombres);
    setApellidos(usuario.apellidos);
    setIdRol(usuario.id_rol);
    setErrorGeneral(null);
    listarRoles()
      .then(setRoles)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [usuario]);

  async function guardar() {
    if (!usuario) return;
    if (!nombres.trim() || !apellidos.trim() || !idRol) {
      setErrorGeneral('Completa nombres, apellidos y rol.');
      return;
    }
    setErrorGeneral(null);
    setGuardando(true);
    try {
      await actualizarUsuario(usuario.id_usuario, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        id_rol: idRol as number,
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
    <Dialog open={!!usuario} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Editar usuario</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}
          <TextField label="Correo" value={usuario?.correo ?? ''} disabled fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Nombres" required fullWidth value={nombres} onChange={(e) => setNombres(e.target.value)} />
            <TextField
              label="Apellidos"
              required
              fullWidth
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
            />
          </Stack>
          <TextField
            select
            label="Rol"
            required
            fullWidth
            value={idRol}
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
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Guardar cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}
