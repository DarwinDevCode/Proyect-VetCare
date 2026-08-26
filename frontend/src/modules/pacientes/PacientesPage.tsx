import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import AddIcon from '@mui/icons-material/Add';
import PetsIcon from '@mui/icons-material/Pets';
import type { Especie, PacienteConFicha } from '../../types/dominio';
import { buscarFichas, listarEspecies } from './api';
import { mensajeError } from '../../lib/errors';
import { calcularEdadTexto } from './edad';
import { NuevoPacienteDialog } from './NuevoPacienteDialog';
import { FichaDialog } from './FichaDialog';
import { useAuth } from '../../auth/AuthContext';

export function PacientesPage() {
  const { sesion } = useAuth();
  const puedeRegistrar = sesion?.rol.codigo === 'recepcionista';

  // Semilla desde ?q=, que llega del buscador de la barra superior (AppLayout).
  // No puede ser un useState perezoso: AppLayout persiste montado entre
  // navegaciones (es el layout padre del <Outlet/>), asi que una busqueda
  // hecha estando ya en /pacientes no remonta esta pagina y el inicializador
  // perezoso nunca se re-ejecutaria. El efecto si reacciona al cambio de
  // parametro; despues, la busqueda dentro de esta pagina sigue siendo local
  // (no se sincroniza de vuelta a la URL en cada tecla).
  const [searchParams] = useSearchParams();
  const [texto, setTexto] = useState('');
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setTexto(q);
  }, [searchParams]);
  const [fichas, setFichas] = useState<PacienteConFicha[]>([]);
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevoAbierto, setDialogoNuevoAbierto] = useState(false);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<PacienteConFicha | null>(null);

  const recargar = useCallback(async (criterio: string) => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await buscarFichas(criterio);
      setFichas(resultado);
      // Si el dialogo de ficha esta abierto, se refresca con los datos nuevos
      // (por ejemplo, la edad recalculada tras editar la fecha de nacimiento).
      setFichaSeleccionada((actual) =>
        actual ? resultado.find((f) => f.id_paciente === actual.id_paciente) ?? null : null,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    listarEspecies().then(setEspecies).catch((err) => setError(mensajeError(err)));
  }, []);

  useEffect(() => {
    const temporizador = setTimeout(() => recargar(texto), 300);
    return () => clearTimeout(temporizador);
  }, [texto, recargar]);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Pacientes y Propietarios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Busca una ficha o registra un nuevo paciente.
          </Typography>
        </Box>
        {puedeRegistrar && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogoNuevoAbierto(true)}
          >
            Nuevo paciente
          </Button>
        )}
      </Stack>

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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
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
              <TableCell>Teléfono</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && fichas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <PetsIcon fontSize="large" />
                    <Typography variant="body2">
                      {texto ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay pacientes registrados.'}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {fichas.map((ficha) => (
              <TableRow
                key={ficha.id_paciente}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setFichaSeleccionada(ficha)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ficha.nombre}
                  </Typography>
                  <Chip
                    label={ficha.sexo === 'M' ? 'Macho' : 'Hembra'}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                </TableCell>
                <TableCell>
                  {ficha.especie.nombre}
                  {ficha.raza ? ` · ${ficha.raza.nombre}` : ''}
                </TableCell>
                <TableCell>{calcularEdadTexto(ficha.fecha_nacimiento)}</TableCell>
                <TableCell>
                  {ficha.propietario.nombres} {ficha.propietario.apellidos}
                </TableCell>
                <TableCell>{ficha.propietario.telefono}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <NuevoPacienteDialog
        abierto={dialogoNuevoAbierto}
        especies={especies}
        onCerrar={() => setDialogoNuevoAbierto(false)}
        onCreado={() => recargar(texto)}
      />

      <FichaDialog
        ficha={fichaSeleccionada}
        especies={especies}
        puedeEditar={puedeRegistrar}
        onCerrar={() => setFichaSeleccionada(null)}
        onActualizado={() => recargar(texto)}
      />
    </Box>
  );
}
