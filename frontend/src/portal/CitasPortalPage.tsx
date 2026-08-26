import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import dayjs from 'dayjs';
import type { PacienteConFicha } from '../types/dominio';
import { listarMisCitas, listarMisMascotas, type CitaPortal } from './api';
import { mensajeError } from '../lib/errors';
import { SolicitarCitaDialog } from './SolicitarCitaDialog';

const ETIQUETA_ESTADO: Record<string, string> = {
  solicitada: 'Solicitada',
  programada: 'Programada',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
};

const COLOR_ESTADO: Record<string, 'warning' | 'primary' | 'secondary' | 'default'> = {
  solicitada: 'warning',
  programada: 'primary',
  atendida: 'secondary',
  cancelada: 'default',
};

// RF-043: mis citas, incluidas las 'solicitada' todavia sin confirmar.
export function CitasPortalPage() {
  const theme = useTheme();
  const esMovil = useMediaQuery(theme.breakpoints.down('sm'));
  const [citas, setCitas] = useState<CitaPortal[]>([]);
  const [mascotas, setMascotas] = useState<PacienteConFicha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [citasResultado, mascotasResultado] = await Promise.all([listarMisCitas(), listarMisMascotas()]);
      setCitas(citasResultado);
      setMascotas(mascotasResultado);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Mis citas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={mascotas.length === 0}
          onClick={() => setDialogoAbierto(true)}
          fullWidth={esMovil}
        >
          Solicitar cita
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!cargando && citas.length === 0 && (
        <Paper variant="outlined" sx={{ py: 6 }}>
          <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <EventIcon fontSize="large" />
            <Typography variant="body2">Todavía no tienes citas registradas.</Typography>
          </Stack>
        </Paper>
      )}

      {citas.length > 0 &&
        (esMovil ? (
          // Una tabla de 5 columnas no entra en una pantalla angosta sin scroll
          // horizontal incomodo -- en movil se reemplaza por una tarjeta por
          // cita, mismo patron que las tarjetas de Mis mascotas.
          <Stack spacing={1.5}>
            {citas.map((c) => (
              <Card key={c.id_cita} variant="outlined">
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {c.paciente.nombre}
                    </Typography>
                    <Chip label={ETIQUETA_ESTADO[c.estado]} size="small" color={COLOR_ESTADO[c.estado]} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {dayjs(c.fecha_hora_inicio).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.veterinario ? `${c.veterinario.nombres} ${c.veterinario.apellidos}` : 'Veterinario por asignar'}
                  </Typography>
                  {c.motivo && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {c.motivo}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mascota</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Veterinario</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {citas.map((c) => (
                  <TableRow key={c.id_cita}>
                    <TableCell>{c.paciente.nombre}</TableCell>
                    <TableCell>{dayjs(c.fecha_hora_inicio).format('DD/MM/YYYY HH:mm')}</TableCell>
                    <TableCell>
                      {c.veterinario ? `${c.veterinario.nombres} ${c.veterinario.apellidos}` : 'Por asignar'}
                    </TableCell>
                    <TableCell>{c.motivo || '—'}</TableCell>
                    <TableCell>
                      <Chip label={ETIQUETA_ESTADO[c.estado]} size="small" color={COLOR_ESTADO[c.estado]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ))}

      <SolicitarCitaDialog
        abierto={dialogoAbierto}
        mascotas={mascotas}
        fullScreen={esMovil}
        onCerrar={() => setDialogoAbierto(false)}
        onCreada={recargar}
      />
    </Box>
  );
}
