import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import type { EventoHistorial, PacienteConFicha } from '../../types/dominio';
import { buscarPacientesActivos, listarHistorial } from './api';
import { mensajeError } from '../../lib/errors';
import { calcularEdadTexto } from './edad';
import { EventoHistorialItem } from './EventoHistorialItem';
import { NuevaConsultaDialog } from './NuevaConsultaDialog';
import { NuevaVacunacionDialog } from './NuevaVacunacionDialog';
import { NuevoExamenDialog } from './NuevoExamenDialog';
import { CompletarExamenDialog } from './CompletarExamenDialog';

interface EstadoDialogoConId {
  abierto: boolean;
  idConsulta?: number;
}

// RF-016 a RF-020, exclusivo de Veterinario (RN-006) -- a diferencia de los otros
// tres modulos, aqui no hace falta ningun condicional de permisos de escritura.
export function HistorialPage() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<PacienteConFicha[]>([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(true);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteConFicha | null>(null);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  const [dialogoConsultaAbierto, setDialogoConsultaAbierto] = useState(false);
  const [dialogoVacunacion, setDialogoVacunacion] = useState<EstadoDialogoConId>({ abierto: false });
  const [dialogoExamen, setDialogoExamen] = useState<EstadoDialogoConId>({ abierto: false });
  const [dialogoCompletar, setDialogoCompletar] = useState<{
    idExamen: number | null;
    fechaSolicitud: string | null;
    abierto: boolean;
  }>({ idExamen: null, fechaSolicitud: null, abierto: false });

  const buscar = useCallback(async (criterio: string) => {
    setCargandoBusqueda(true);
    setErrorBusqueda(null);
    try {
      setResultados(await buscarPacientesActivos(criterio));
    } catch (err) {
      setErrorBusqueda(mensajeError(err));
    } finally {
      setCargandoBusqueda(false);
    }
  }, []);

  useEffect(() => {
    if (pacienteSeleccionado) return;
    const temporizador = setTimeout(() => buscar(texto), 300);
    return () => clearTimeout(temporizador);
  }, [texto, buscar, pacienteSeleccionado]);

  const recargarHistorial = useCallback(async () => {
    if (!pacienteSeleccionado) return;
    setCargandoHistorial(true);
    setErrorHistorial(null);
    try {
      setHistorial(await listarHistorial(pacienteSeleccionado.id_paciente));
    } catch (err) {
      setErrorHistorial(mensajeError(err));
    } finally {
      setCargandoHistorial(false);
    }
  }, [pacienteSeleccionado]);

  useEffect(() => {
    recargarHistorial();
  }, [recargarHistorial]);

  if (!pacienteSeleccionado) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Historial Clínico
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Busca un paciente para ver o registrar su historial clínico.
        </Typography>

        <TextField
          fullWidth
          placeholder="Buscar por nombre de la mascota, cédula o nombre del propietario…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          sx={{ mb: 2, maxWidth: 520 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {errorBusqueda && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorBusqueda}
          </Alert>
        )}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mascota</TableCell>
                <TableCell>Especie / Raza</TableCell>
                <TableCell>Edad</TableCell>
                <TableCell>Propietario</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!cargandoBusqueda && resultados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                      <MedicalInformationIcon fontSize="large" />
                      <Typography variant="body2">
                        {texto ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay pacientes registrados.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
              {resultados.map((ficha) => (
                <TableRow
                  key={ficha.id_paciente}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setPacienteSeleccionado(ficha)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ficha.nombre}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {ficha.especie.nombre}
                    {ficha.raza ? ` · ${ficha.raza.nombre}` : ''}
                  </TableCell>
                  <TableCell>{calcularEdadTexto(ficha.fecha_nacimiento)}</TableCell>
                  <TableCell>
                    {ficha.propietario.nombres} {ficha.propietario.apellidos}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  const paciente = pacienteSeleccionado;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => setPacienteSeleccionado(null)}
        sx={{ mb: 2 }}
      >
        Buscar otro paciente
      </Button>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {paciente.nombre}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {paciente.especie.nombre}
            {paciente.raza ? ` · ${paciente.raza.nombre}` : ''} ·{' '}
            {calcularEdadTexto(paciente.fecha_nacimiento)} · Propietario: {paciente.propietario.nombres}{' '}
            {paciente.propietario.apellidos}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={() => setDialogoConsultaAbierto(true)}>
            Nueva consulta
          </Button>
          <Button variant="outlined" onClick={() => setDialogoVacunacion({ abierto: true })}>
            Nueva vacunación
          </Button>
          <Button variant="outlined" onClick={() => setDialogoExamen({ abierto: true })}>
            Nuevo examen
          </Button>
        </Stack>
      </Stack>

      {errorHistorial && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorHistorial}
        </Alert>
      )}

      <Stack spacing={2}>
        {!cargandoHistorial && historial.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Todavía no hay consultas, vacunas ni exámenes registrados para este paciente.
            </Typography>
          </Paper>
        )}
        {historial.map((evento) => (
          <EventoHistorialItem
            key={`${evento.tipo_evento}-${evento.id_evento}`}
            evento={evento}
            onAbrirVacunacion={(idConsulta) => setDialogoVacunacion({ abierto: true, idConsulta })}
            onAbrirExamen={(idConsulta) => setDialogoExamen({ abierto: true, idConsulta })}
            onAbrirCompletarExamen={(idExamen, fechaSolicitud) =>
              setDialogoCompletar({ idExamen, fechaSolicitud, abierto: true })
            }
          />
        ))}
      </Stack>

      <NuevaConsultaDialog
        idPaciente={paciente.id_paciente}
        abierto={dialogoConsultaAbierto}
        onCerrar={() => setDialogoConsultaAbierto(false)}
        onCreado={recargarHistorial}
      />
      <NuevaVacunacionDialog
        idPaciente={paciente.id_paciente}
        idConsulta={dialogoVacunacion.idConsulta}
        abierto={dialogoVacunacion.abierto}
        onCerrar={() => setDialogoVacunacion({ abierto: false })}
        onCreado={recargarHistorial}
      />
      <NuevoExamenDialog
        idPaciente={paciente.id_paciente}
        idConsulta={dialogoExamen.idConsulta}
        abierto={dialogoExamen.abierto}
        onCerrar={() => setDialogoExamen({ abierto: false })}
        onCreado={recargarHistorial}
      />
      <CompletarExamenDialog
        idExamen={dialogoCompletar.idExamen}
        fechaSolicitud={dialogoCompletar.fechaSolicitud}
        abierto={dialogoCompletar.abierto}
        onCerrar={() => setDialogoCompletar({ idExamen: null, fechaSolicitud: null, abierto: false })}
        onActualizado={recargarHistorial}
      />
    </Box>
  );
}
