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
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PetsIcon from '@mui/icons-material/Pets';
import dayjs from 'dayjs';
import type { PacienteConFicha, TratamientoPortal, VacunaCarnetPortal } from '../types/dominio';
import { listarCarnetPorPaciente, listarMisMascotas, listarTratamientosPorPaciente } from './api';
import { mensajeError } from '../lib/errors';
import { calcularEdadTexto } from '../modules/pacientes/edad';

// RF-044: mascotas propias + carnet de vacunas + tratamientos. Este ultimo
// amplia RN-006 deliberadamente (confirmado con el cliente, ver CLAUDE.md
// seccion 14) -- SOLO tratamiento, nunca diagnostico ni hallazgos, que
// v_tratamientos_portal ni siquiera selecciona.
export function MascotasPortalPage() {
  const theme = useTheme();
  const esMovil = useMediaQuery(theme.breakpoints.down('sm'));
  const [mascotas, setMascotas] = useState<PacienteConFicha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seleccionada, setSeleccionada] = useState<PacienteConFicha | null>(null);
  const [carnet, setCarnet] = useState<VacunaCarnetPortal[]>([]);
  const [tratamientos, setTratamientos] = useState<TratamientoPortal[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    listarMisMascotas()
      .then(setMascotas)
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!seleccionada) return;
    setCargandoDetalle(true);
    Promise.all([
      listarCarnetPorPaciente(seleccionada.id_paciente),
      listarTratamientosPorPaciente(seleccionada.id_paciente),
    ])
      .then(([v, t]) => {
        setCarnet(v);
        setTratamientos(t);
      })
      .catch(() => {
        setCarnet([]);
        setTratamientos([]);
      })
      .finally(() => setCargandoDetalle(false));
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

      <Dialog open={!!seleccionada} onClose={() => setSeleccionada(null)} maxWidth="sm" fullWidth fullScreen={esMovil}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          {seleccionada?.nombre}
          <IconButton sx={{ ml: 'auto' }} onClick={() => setSeleccionada(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {seleccionada && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {seleccionada.especie.nombre}
                  {seleccionada.raza ? ` · ${seleccionada.raza.nombre}` : ' · Mestizo'} ·{' '}
                  {seleccionada.sexo === 'M' ? 'Macho' : 'Hembra'}
                  {seleccionada.color ? ` · ${seleccionada.color}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calcularEdadTexto(seleccionada.fecha_nacimiento)}
                  {seleccionada.fecha_nacimiento
                    ? ` · Nació el ${dayjs(seleccionada.fecha_nacimiento).format('DD/MM/YYYY')}`
                    : ''}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Vacunas
                </Typography>
                {!cargandoDetalle && carnet.length === 0 && (
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
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Tratamientos
                </Typography>
                {!cargandoDetalle && tratamientos.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Sin tratamientos registrados todavía.
                  </Typography>
                )}
                <Stack spacing={1.5}>
                  {tratamientos.map((t) => (
                    <Box key={t.id_consulta}>
                      <Typography variant="body2" color="text.secondary">
                        {dayjs(t.fecha_hora).format('DD/MM/YYYY')} · {t.motivo}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.tratamiento}
                      </Typography>
                      {t.peso_kg != null && (
                        <Typography variant="body2" color="text.secondary">
                          Peso registrado: {t.peso_kg} kg
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
