import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import dayjs, { type Dayjs } from 'dayjs';
import type { CitaConDetalle, Usuario } from '../../types/dominio';
import {
  listarCitasDelDia,
  listarCitasDeLaSemana,
  listarSolicitudesPendientes,
  listarVeterinarios,
  type ListaEsperaConPaciente,
} from './api';
import { mensajeError } from '../../lib/errors';
import { AgendaGrid } from './AgendaGrid';
import { AgendaSemanal } from './AgendaSemanal';
import { NuevaCitaDialog } from './NuevaCitaDialog';
import { CitaDetalleDialog } from './CitaDetalleDialog';
import { ListaEsperaTab } from './ListaEsperaTab';
import { useAuth } from '../../auth/AuthContext';

type Vista = 'dia' | 'semana';
type Seccion = 'agenda' | 'lista-espera';

// Lunes de la semana que contiene "fecha" -- dayjs().day() da 0 (domingo) a 6
// (sabado); sin el offset, restar "day()" dias llevaria a domingo, no a lunes.
// No se agrega el plugin isoWeek de dayjs solo para esto (RNF-021, minimizar
// dependencias nuevas).
function lunesDeLaSemana(fecha: Dayjs): Dayjs {
  const diaIso = (fecha.day() + 6) % 7;
  return fecha.subtract(diaIso, 'day').startOf('day');
}

interface PrefillNueva {
  idVeterinario?: string;
  hora?: Dayjs;
  pacienteInicial?: CitaConDetalle['paciente'];
  idListaEspera?: number;
}

export function AgendaPage() {
  const { sesion } = useAuth();
  const puedeGestionar = sesion?.rol.codigo === 'recepcionista';
  const theme = useTheme();
  const esMovil = useMediaQuery(theme.breakpoints.down('sm'));

  const [seccion, setSeccion] = useState<Seccion>('agenda');
  const [vista, setVista] = useState<Vista>('dia');
  const [fecha, setFecha] = useState<Dayjs>(() => dayjs());
  const [veterinarios, setVeterinarios] = useState<Usuario[]>([]);
  const [veterinariosSeleccionados, setVeterinariosSeleccionados] = useState<string[]>([]);
  // La vista semanal responde una pregunta distinta a la diaria (RF-013,
  // "cuando tiene un hueco esta semana Dr. Vera" vs "quien esta libre ahora"),
  // por eso necesita un unico veterinario, no la seleccion multiple de la vista
  // por dia.
  const [vetSemana, setVetSemana] = useState('');
  const [citas, setCitas] = useState<CitaConDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [prefillNueva, setPrefillNueva] = useState<PrefillNueva | null>(null);
  const [citaSeleccionada, setCitaSeleccionada] = useState<CitaConDetalle | null>(null);

  // RF-043 (Fase 5): solicitudes de cita hechas desde el portal, pendientes de que
  // Recepcion les asigne veterinario/horario real. No caben en AgendaGrid (agrupa
  // por veterinario, y una solicitud todavia no tiene uno), asi que se listan aparte.
  const [solicitudes, setSolicitudes] = useState<CitaConDetalle[]>([]);

  const recargarSolicitudes = useCallback(async () => {
    if (!puedeGestionar) return;
    try {
      setSolicitudes(await listarSolicitudesPendientes());
    } catch {
      // Silencioso: no es la carga principal de la pagina, y ya hay un error
      // general para la agenda si el problema es de conexion.
    }
  }, [puedeGestionar]);

  const recargar = useCallback(async (f: Dayjs, v: Vista) => {
    setCargando(true);
    setError(null);
    try {
      const resultado =
        v === 'dia' ? await listarCitasDelDia(f.format('YYYY-MM-DD')) : await listarCitasDeLaSemana(lunesDeLaSemana(f));
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
        setVetSemana((actual) => actual || vets[0]?.id_usuario || '');
      })
      .catch((err) => setError(mensajeError(err)));
  }, []);

  useEffect(() => {
    recargar(fecha, vista);
  }, [fecha, vista, recargar]);

  useEffect(() => {
    recargarSolicitudes();
  }, [recargarSolicitudes]);

  function alternarVeterinario(id: string) {
    setVeterinariosSeleccionados((actual) =>
      actual.includes(id) ? actual.filter((v) => v !== id) : [...actual, id],
    );
  }

  function abrirNuevaCita(prefill: PrefillNueva | null) {
    setPrefillNueva(prefill);
    setDialogoNuevaAbierto(true);
  }

  // Wiring RF-015 (1i): "Agendar con este cupo" desde CitaDetalleDialog. Se cierra
  // el detalle y se abre Nueva cita ya con paciente/veterinario/hora del cupo
  // liberado -- el usuario solo confirma o ajusta, no vuelve a buscar nada.
  function agendarDesdeListaEspera(entrada: ListaEsperaConPaciente, citaCancelada: CitaConDetalle) {
    setCitaSeleccionada(null);
    abrirNuevaCita({
      idVeterinario: citaCancelada.id_veterinario ?? undefined,
      hora: dayjs(citaCancelada.fecha_hora_inicio),
      pacienteInicial: entrada.paciente,
      idListaEspera: entrada.id_lista_espera,
    });
  }

  const veterinariosVisibles = veterinarios.filter((v) => veterinariosSeleccionados.includes(v.id_usuario));
  const citasSemanaDelVet = citas.filter((c) => c.id_veterinario === vetSemana);

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
        {seccion === 'agenda' && puedeGestionar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNuevaCita(null)}>
            Nueva cita
          </Button>
        )}
      </Stack>

      {solicitudes.length > 0 && (
        <Alert
          severity="warning"
          icon={<EventBusyIcon />}
          sx={{ mb: 2 }}
          action={
            solicitudes.length === 1 ? (
              <Button color="inherit" size="small" onClick={() => setCitaSeleccionada(solicitudes[0])}>
                Ver
              </Button>
            ) : undefined
          }
        >
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {solicitudes.length} solicitud{solicitudes.length === 1 ? '' : 'es'} de cita desde el portal,
              pendiente{solicitudes.length === 1 ? '' : 's'} de confirmar.
            </Typography>
            {solicitudes.length > 1 &&
              solicitudes.map((s) => (
                <Typography
                  key={s.id_cita}
                  variant="body2"
                  sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setCitaSeleccionada(s)}
                >
                  {s.paciente.nombre} ({s.paciente.propietario.nombres} {s.paciente.propietario.apellidos}) —{' '}
                  {dayjs(s.fecha_hora_inicio).format('DD/MM/YYYY')}
                </Typography>
              ))}
          </Stack>
        </Alert>
      )}

      <Tabs
        value={seccion}
        onChange={(_e, valor: Seccion) => setSeccion(valor)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="agenda" label="Agenda" />
        <Tab value="lista-espera" label="Lista de espera" />
      </Tabs>

      {seccion === 'lista-espera' ? (
        <ListaEsperaTab veterinarios={veterinarios} puedeGestionar={puedeGestionar} />
      ) : (
        <>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 2 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <IconButton
            onClick={() => setFecha((f) => f.subtract(1, vista === 'dia' ? 'day' : 'week'))}
            aria-label={vista === 'dia' ? 'Día anterior' : 'Semana anterior'}
          >
            <ChevronLeftIcon />
          </IconButton>
          <DatePicker
            value={fecha}
            onChange={(nueva) => nueva && setFecha(nueva)}
            slotProps={{ textField: { size: 'small', sx: { width: 170 } } }}
          />
          <IconButton
            onClick={() => setFecha((f) => f.add(1, vista === 'dia' ? 'day' : 'week'))}
            aria-label={vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
          >
            <ChevronRightIcon />
          </IconButton>
          <Button size="small" onClick={() => setFecha(dayjs())}>
            Hoy
          </Button>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={vista}
            onChange={(_e, valor: Vista | null) => valor && setVista(valor)}
          >
            <ToggleButton value="dia">Día</ToggleButton>
            <ToggleButton value="semana">Semana</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {vista === 'semana' ? (
          // RF-013: la vista semanal es de un solo veterinario a la vez (ver
          // AgendaSemanal) -- este selector reemplaza a los chips de seleccion
          // multiple de la vista por dia, no los complementa.
          <TextField
            select
            size="small"
            label="Veterinario"
            value={vetSemana}
            onChange={(e) => setVetSemana(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {veterinarios.map((v) => (
              <MenuItem key={v.id_usuario} value={v.id_usuario}>
                {v.nombres} {v.apellidos}
              </MenuItem>
            ))}
          </TextField>
        ) : esMovil ? (
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
      ) : vista === 'dia' ? (
        <AgendaGrid
          fecha={fecha}
          veterinarios={veterinariosVisibles}
          citas={citas}
          puedeCrear={puedeGestionar}
          onClickSlotVacio={(idVeterinario, hora) => abrirNuevaCita({ idVeterinario, hora })}
          onClickCita={setCitaSeleccionada}
        />
      ) : (
        <AgendaSemanal
          inicioSemana={lunesDeLaSemana(fecha)}
          citas={citasSemanaDelVet}
          puedeCrear={puedeGestionar}
          onClickSlotVacio={(_dia, hora) => abrirNuevaCita({ idVeterinario: vetSemana, hora })}
          onClickCita={setCitaSeleccionada}
        />
      )}
        </>
      )}

      <NuevaCitaDialog
        abierto={dialogoNuevaAbierto}
        veterinarios={veterinarios}
        fechaPorDefecto={fecha}
        prefill={prefillNueva}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        onCreada={() => recargar(fecha, vista)}
      />

      <CitaDetalleDialog
        cita={citaSeleccionada}
        veterinarios={veterinarios}
        puedeGestionar={puedeGestionar}
        onCerrar={() => setCitaSeleccionada(null)}
        onActualizado={() => {
          recargar(fecha, vista);
          recargarSolicitudes();
        }}
        onAgendarDesdeListaEspera={agendarDesdeListaEspera}
      />
    </Box>
  );
}
