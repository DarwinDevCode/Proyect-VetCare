import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import { usePortalAuth } from './PortalAuthContext';
import { OlvidePasswordDialog } from './OlvidePasswordDialog';

// Analoga a auth/LoginPage.tsx, pero contra el portal -- sin autoregistro: el
// acceso lo emite Recepcion desde la ficha del propietario (RF-042).
export function LoginPortalPage() {
  const { iniciarSesion, errorPerfil } = usePortalAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogoOlvideAbierto, setDialogoOlvideAbierto] = useState(false);

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    if (!correo || !password) {
      setError('Ingresa tu correo y tu contraseña para continuar.');
      return;
    }
    setEnviando(true);
    setError(null);
    const resultado = await iniciarSesion(correo, password);
    setEnviando(false);
    if (resultado.error) setError(resultado.error);
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper elevation={2} sx={{ p: 4, width: 380, maxWidth: '100%' }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: 'center' }}>
          <PetsIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            VetCare
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Portal del propietario
          </Typography>
        </Stack>

        <form onSubmit={manejarEnvio} noValidate>
          <Stack spacing={2}>
            {(error || errorPerfil) && <Alert severity="error">{error ?? errorPerfil}</Alert>}

            <TextField
              label="Correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoFocus
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
            />
            <Button type="submit" variant="contained" size="large" loading={enviando}>
              Ingresar
            </Button>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ textAlign: 'center' }}
              onClick={() => setDialogoOlvideAbierto(true)}
            >
              ¿Olvidaste tu contraseña?
            </Link>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              ¿Todavía no tienes acceso? Pídelo en tu próxima visita a la clínica.
            </Typography>
          </Stack>
        </form>
      </Paper>

      <OlvidePasswordDialog abierto={dialogoOlvideAbierto} onCerrar={() => setDialogoOlvideAbierto(false)} />
    </Box>
  );
}
