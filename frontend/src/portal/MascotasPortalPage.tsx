import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PetsIcon from '@mui/icons-material/Pets';
import dayjs from 'dayjs';
import type { PacienteConFicha, VacunaCarnetPortal } from '../types/dominio';
import { listarCarnetPorPaciente, listarMisMascotas } from './api';
import { mensajeError } from '../lib/errors';
import { calcularEdadTexto } from '../modules/pacientes/edad';

// RF-044: mascotas propias + su carnet de vacunas. Sin diagnostico, hallazgos ni
// tratamiento -- RN-006 sigue intacto tambien en el portal (v_carnet_portal).
export function MascotasPortalPage() {
  const [mascotas, setMascotas] = useState<PacienteConFicha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seleccionada, setSeleccionada] = useState<PacienteConFicha | null>(null);
  const [carnet, setCarnet] = useState<VacunaCarnetPortal[]>([]);
  const [cargandoCarnet, setCargandoCarnet] = useState(false);

  useEffect(() => {
    listarMisMascotas()
      .then(setMascotas)
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!seleccionada) return;
    setCargandoCarnet(true);
    listarCarnetPorPaciente(seleccionada.id_paciente)
      .then(setCarnet)
      .catch(() => setCarnet([]))
      .finally(() => setCargandoCarnet(false));
  }, [seleccionada]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Mis mascotas
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!cargando && mascotas.length === 0 && (
        <Alert severity="info">Todavía no tienes mascotas registradas en VetCare.</Alert>
      )}

      <Grid container spacing={2}>
        {mascotas.map((mascota) => (
          <Grid key={mascota.id_paciente} size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardActionArea onClick={() => setSeleccionada(mascota)}>
                <CardContent>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                    <PetsIcon color="primary" />
                    <Typography variant="h6">{mascota.nombre}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {mascota.especie.nombre}
                    {mascota.raza ? ` · ${mascota.raza.nombre}` : ' · Mestizo'} ·{' '}
                    {mascota.sexo === 'M' ? 'Macho' : 'Hembra'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {calcularEdadTexto(mascota.fecha_nacimiento)}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={!!seleccionada} onClose={() => setSeleccionada(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          Carnet de vacunas · {seleccionada?.nombre}
          <IconButton sx={{ ml: 'auto' }} onClick={() => setSeleccionada(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!cargandoCarnet && carnet.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Sin vacunas registradas todavía.
            </Typography>
          )}
          <Stack spacing={1.5}>
            {carnet.map((v) => (
              <Box key={v.id_vacunacion}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {v.producto}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aplicada: {dayjs(v.fecha_aplicacion).format('DD/MM/YYYY')}
                  {v.proxima_fecha ? ` · Próxima: ${dayjs(v.proxima_fecha).format('DD/MM/YYYY')}` : ''}
                </Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
