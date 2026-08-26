import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import dayjs from 'dayjs';
import type { EstadoListaEspera, Usuario } from '../../types/dominio';
import { cancelarListaEspera, listarListaEspera, type ListaEsperaConPaciente } from './api';
import { mensajeError } from '../../lib/errors';
import { NuevaListaEsperaDialog } from './NuevaListaEsperaDialog';

interface Props {
  veterinarios: Usuario[];
  puedeGestionar: boolean;
}

const ETIQUETA_ESTADO: Record<EstadoListaEspera, string> = {
  pendiente: 'Pendiente',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
};

const COLOR_ESTADO: Record<EstadoListaEspera, 'primary' | 'success' | 'default'> = {
  pendiente: 'primary',
  atendida: 'success',
  cancelada: 'default',
};

const ETIQUETA_FRANJA = { manana: 'Mañana', tarde: 'Tarde' } as const;

type FiltroEstado = 'pendientes' | 'todas';

// RF-034/RF-035: tabla real, sin notificacion (WhatsApp/Email/SMS sigue fuera de
// alcance). Mismo patron de acceso que el resto de Agenda -- Recepcionista
// gestiona, Veterinario solo consulta (puedeGestionar ya lo decide AgendaPage).
export function ListaEsperaTab({ veterinarios, puedeGestionar }: Props) {
  const [entradas, setEntradas] = useState<ListaEsperaConPaciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>('pendientes');
  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setEntradas(await listarListaEspera());
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const entradasFiltradas = useMemo(
    () => (filtro === 'pendientes' ? entradas.filter((e) => e.estado === 'pendiente') : entradas),
    [entradas, filtro],
  );

  async function cancelar(id: number) {
    setCancelandoId(id);
    setError(null);
    try {
      await cancelarListaEspera(id);
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCancelandoId(null);
    }
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
      >
        <Stack direction="row" spacing={1}>
          <Chip
            label="Pendientes"
            size="small"
            color={filtro === 'pendientes' ? 'primary' : 'default'}
            variant={filtro === 'pendientes' ? 'filled' : 'outlined'}
            onClick={() => setFiltro('pendientes')}
          />
          <Chip
            label="Todas"
            size="small"
            color={filtro === 'todas' ? 'primary' : 'default'}
            variant={filtro === 'todas' ? 'filled' : 'outlined'}
            onClick={() => setFiltro('todas')}
          />
        </Stack>
        {puedeGestionar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogoNuevaAbierto(true)}>
            Nueva entrada
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Paciente</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Veterinario preferido</TableCell>
              <TableCell>Preferencia</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Estado</TableCell>
              {puedeGestionar && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && entradasFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={puedeGestionar ? 7 : 6} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <HourglassEmptyIcon fontSize="large" />
                    <Typography variant="body2">
                      {filtro === 'pendientes'
                        ? 'Sin propietarios en espera por ahora.'
                        : 'Todavía no hay entradas registradas.'}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {entradasFiltradas.map((entrada) => (
              <TableRow key={entrada.id_lista_espera}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entrada.paciente.nombre}
                  </Typography>
                </TableCell>
                <TableCell>
                  {entrada.paciente.propietario.nombres} {entrada.paciente.propietario.apellidos}
                </TableCell>
                <TableCell>
                  {entrada.veterinario ? `${entrada.veterinario.nombres} ${entrada.veterinario.apellidos}` : 'Cualquiera'}
                </TableCell>
                <TableCell>
                  {entrada.fecha_preferida ? dayjs(entrada.fecha_preferida).format('DD/MM/YYYY') : 'Sin preferencia'}
                  {entrada.franja_preferida ? ` · ${ETIQUETA_FRANJA[entrada.franja_preferida]}` : ''}
                </TableCell>
                <TableCell sx={{ maxWidth: 220 }}>{entrada.motivo}</TableCell>
                <TableCell>
                  <Chip label={ETIQUETA_ESTADO[entrada.estado]} size="small" color={COLOR_ESTADO[entrada.estado]} />
                </TableCell>
                {puedeGestionar && (
                  <TableCell>
                    {entrada.estado === 'pendiente' && (
                      <Button
                        size="small"
                        color="error"
                        loading={cancelandoId === entrada.id_lista_espera}
                        onClick={() => cancelar(entrada.id_lista_espera)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <NuevaListaEsperaDialog
        abierto={dialogoNuevaAbierto}
        veterinarios={veterinarios}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        onCreada={recargar}
      />
    </Box>
  );
}
