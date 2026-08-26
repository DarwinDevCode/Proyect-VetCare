import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { UsuarioConRol } from '../../types/dominio';
import { restablecerContrasena } from './api';

interface Props {
  usuario: UsuarioConRol | null;
  onCerrar: () => void;
}

// AD-06: la unica accion de todo el modulo de cuentas que no tensiona
// RNF-003/RES-03 -- sigue delegando la verificacion de credenciales en el
// servicio de autenticacion de la plataforma, solo que el cambio lo dispara
// un Administrador en vez del propio usuario.
export function RestablecerContrasenaDialog({ usuario, onCerrar }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPassword('');
    setError(null);
    setExito(false);
  }, [usuario]);

  async function guardar() {
    if (!usuario) return;
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await restablecerContrasena(usuario.id_usuario, password);
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={!!usuario} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Restablecer contraseña</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {exito ? (
            <Alert severity="success">
              Contraseña actualizada. Comunícasela a {usuario?.nombres} por un canal seguro; se le pedirá cambiarla
              en su próximo uso si así lo prefiere.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Nueva contraseña temporal para {usuario?.nombres} {usuario?.apellidos}.
              </Typography>
              <TextField
                label="Nueva contraseña"
                fullWidth
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{exito ? 'Cerrar' : 'Cancelar'}</Button>
        {!exito && (
          <Button variant="contained" onClick={guardar} loading={guardando}>
            Restablecer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
