import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { supabase } from '../lib/supabaseClient';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

// Ampliacion posterior a la Fase 5 (CLAUDE.md seccion 14): hasta ahora no
// existia ninguna forma de cambiar la contrasena desde el portal -- toda cuenta
// nace con una contrasena generada por el sistema (manual o automatica) y
// dependia de que Recepcion la restableciera de nuevo. supabase.auth.updateUser
// opera con el JWT propio de la sesion, sin tocar ninguna tabla ni necesitar la
// service_role key (auth.email.secure_password_change = false en config.toml
// confirma que no hace falta pedir la contrasena actual).
export function CambiarPasswordDialog({ abierto, onCerrar }: Props) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  function cerrar() {
    setPassword('');
    setConfirmacion('');
    setErrores({});
    setErrorGeneral(null);
    setExito(false);
    onCerrar();
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (password.length < 8) nuevosErrores.password = 'Debe tener al menos 8 caracteres.';
    if (confirmacion !== password) nuevosErrores.confirmacion = 'No coincide con la contraseña nueva.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setExito(true);
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar contraseña</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}
          {exito ? (
            <Alert severity="success">Tu contraseña se actualizó correctamente.</Alert>
          ) : (
            <>
              <TextField
                label="Contraseña nueva"
                type="password"
                required
                fullWidth
                autoFocus
                value={password}
                error={!!errores.password}
                helperText={errores.password || 'Mínimo 8 caracteres.'}
                onChange={(e) => setPassword(e.target.value)}
              />
              <TextField
                label="Confirmar contraseña nueva"
                type="password"
                required
                fullWidth
                value={confirmacion}
                error={!!errores.confirmacion}
                helperText={errores.confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar}>{exito ? 'Cerrar' : 'Cancelar'}</Button>
        {!exito && (
          <Button variant="contained" onClick={guardar} loading={guardando}>
            Guardar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
