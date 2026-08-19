import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs, { type Dayjs } from 'dayjs';
import type { CitaConDetalle, Usuario } from '../../types/dominio';
import { listarCitasDelDia, listarVeterinarios } from './api';
import { mensajeError } from '../../lib/errors';
import { AgendaGrid } from './AgendaGrid';
import { NuevaCitaDialog } from './NuevaCitaDialog';
import { CitaDetalleDialog } from './CitaDetalleDialog';
import { useAuth } from '../../auth/AuthContext';

interface PrefillNueva {
  idVeterinario?: string;
  hora?: Dayjs;
}

export function AgendaPage() {
  const { sesion } = useAuth();
  const puedeGestionar = sesion?.rol.codigo === 'recepcionista';
  const theme = useTheme();
  const esMovil = useMediaQuery(theme.breakpoints.down('sm'));

  const [fecha, setFecha] = useState<Dayjs>(() => dayjs());
  const [veterinarios, setVeterinarios] = useState<Usuario[]>([]);
  const [veterinariosSeleccionados, setVeterinariosSeleccionados] = useState<string[]>([]);
  const [citas, setCitas] = useState<CitaConDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [prefillNueva, setPrefillNueva] = useState<PrefillNueva | null>(null);
  const [citaSeleccionada, setCitaSeleccionada] = useState<CitaConDetalle | null>(null);

  const recargar = useCallback(async (f: Dayjs) => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarCitasDelDia(f.format('YYYY-MM-DD'));
      setCitas(resultado);
      // Si el detalle de una cita esta abierto, se refresca con los datos nuevos
      // (mismo patron que PacientesPage tras editar una ficha).
      setCitaSeleccionada((actual) =>
        actual ? resultado.find((c) => c.id_cita === actual.id_cita) ?? null : null,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    listarVeterinarios()
      .then((vets) => {
        setVeterinarios(vets);
        setVeterinariosSeleccionados(vets.map((v) => v.id_usuario));
      })
      .catch((err) => setError(mensajeError(err)));
  }, []);

  useEffect(() => {
    recargar(fecha);
  }, [fecha, recargar]);

  function alternarVeterinario(id: string) {
    setVeterinariosSeleccionados((actual) =>
      actual.includes(id) ? actual.filter((v) => v !== id) : [...actual, id],
    );
  }

  function abrirNuevaCita(prefill: PrefillNueva | null) {
    setPrefillNueva(prefill);
    setDialogoNuevaAbierto(true);
  }

  const veterinariosVisibles = veterinarios.filter((v) => veterinariosSeleccionados.includes(v.id_usuario));

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Agenda y Citas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta y gestiona las citas programadas por veterinario y por día.
          </Typography>
        </Box>
        {puedeGestionar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNuevaCita(null)}>
            Nueva cita
          </Button>
        )}
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 2 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <IconButton onClick={() => setFecha((f) => f.subtract(1, 'day'))} aria-label="Día anterior">
            <ChevronLeftIcon />
          </IconButton>
          <DatePicker
            value={fecha}
            onChange={(nueva) => nueva && setFecha(nueva)}
            slotProps={{ textField: { size: 'small', sx: { width: 170 } } }}
          />
          <IconButton onClick={() => setFecha((f) => f.add(1, 'day'))} aria-label="Día siguiente">
            <ChevronRightIcon />
          </IconButton>
          <Button size="small" onClick={() => setFecha(dayjs())}>
            Hoy
          </Button>
        </Stack>

        {esMovil ? (
          <TextField
            select
            size="small"
            label="Veterinario"
            value={veterinariosSeleccionados[0] ?? ''}
            onChange={(e) => setVeterinariosSeleccionados([e.target.value])}
            sx={{ minWidth: 200 }}
          >
            {veterinarios.map((v) => (
              <MenuItem key={v.id_usuario} value={v.id_usuario}>
                {v.nombres} {v.apellidos}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {veterinarios.map((v) => {
              const activo = veterinariosSeleccionados.includes(v.id_usuario);
              return (
                <Chip
                  key={v.id_usuario}
                  label={`${v.nombres} ${v.apellidos}`}
                  size="small"
                  color={activo ? 'primary' : 'default'}
                  variant={activo ? 'filled' : 'outlined'}
                  onClick={() => alternarVeterinario(v.id_usuario)}
                />
              );
            })}
          </Stack>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!cargando && veterinarios.length === 0 ? (
        <Alert severity="info">No hay veterinarios activos registrados.</Alert>
      ) : (
        <AgendaGrid
          fecha={fecha}
          veterinarios={veterinariosVisibles}
          citas={citas}
          puedeCrear={puedeGestionar}
          onClickSlotVacio={(idVeterinario, hora) => abrirNuevaCita({ idVeterinario, hora })}
          onClickCita={setCitaSeleccionada}
        />
      )}

      <NuevaCitaDialog
        abierto={dialogoNuevaAbierto}
        veterinarios={veterinarios}
        fechaPorDefecto={fecha}
        prefill={prefillNueva}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        onCreada={() => recargar(fecha)}
      />

      <CitaDetalleDialog
        cita={citaSeleccionada}
        veterinarios={veterinarios}
        puedeGestionar={puedeGestionar}
        onCerrar={() => setCitaSeleccionada(null)}
        onActualizado={() => recargar(fecha)}
      />
    </Box>
  );
}
