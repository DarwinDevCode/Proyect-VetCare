import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { solicitarRestablecerPassword } from './api';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

// "Olvidé mi contraseña" desde el login del portal (LoginPortalPage.tsx) --
// hasta ahora "Cambiar contraseña" solo existia dentro de una sesion ya
// iniciada (menu del avatar, PortalLayout.tsx); un propietario que no recuerda
// su contraseña no tenia ninguna salida. El mensaje de resultado es SIEMPRE el
// mismo, exista o no una cuenta con ese correo -- coherente con que la Edge
// Function tampoco lo revela (evita que alguien use este formulario para
// averiguar que correos estan registrados).
export function OlvidePasswordDialog({ abierto, onCerrar }: Props) {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setCorreo('');
    setEnviando(false);
    setEnviado(false);
    setError(null);
    onCerrar();
  }

  async function enviar() {
    if (!correo.trim()) {
      setError('Ingresa tu correo.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await solicitarRestablecerPassword(correo.trim());
      setEnviado(true);
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="xs" fullWidth>
      <DialogTitle>¿Olvidaste tu contraseña?</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {enviado ? (
            <Alert severity="success">
              Si ese correo está registrado en el portal, te enviamos instrucciones para acceder.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Ingresa el correo con el que accedes al portal y te enviaremos una contraseña nueva.
              </Typography>
              <TextField
                label="Correo"
                type="email"
                required
                fullWidth
                autoFocus
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="username"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar}>{enviado ? 'Cerrar' : 'Cancelar'}</Button>
        {!enviado && (
          <Button variant="contained" onClick={enviar} loading={enviando}>
            Enviar instrucciones
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
