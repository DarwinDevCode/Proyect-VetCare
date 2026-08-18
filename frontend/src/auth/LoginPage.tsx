import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { iniciarSesion, errorPerfil } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Sistema de Gestión Veterinaria
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
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
