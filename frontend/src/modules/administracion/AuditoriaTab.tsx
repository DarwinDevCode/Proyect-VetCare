import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import HistoryIcon from '@mui/icons-material/History';
import dayjs from 'dayjs';
import type { EntradaAuditoriaConUsuario } from '../../types/dominio';
import { listarAuditoria } from './api';
import { mensajeError } from '../../lib/errors';

const TABLAS_AUDITADAS = ['usuario', 'rol', 'especie', 'raza', 'parametro_sistema'];

const ETIQUETA_TABLA: Record<string, string> = {
  usuario: 'Usuario',
  rol: 'Rol',
  especie: 'Especie',
  raza: 'Raza',
  parametro_sistema: 'Parámetro',
};

// AD-17/AD-19: bitacora de cambios administrativos. Distinto de RF-003 (que
// audita operaciones clinicas/inventario/factura): esto cubre cuentas, roles,
// catalogos y parametros, que antes de este modulo no dejaban ningun rastro.
export function AuditoriaTab() {
  const [entradas, setEntradas] = useState<EntradaAuditoriaConUsuario[]>([]);
  const [tabla, setTabla] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entradaSeleccionada, setEntradaSeleccionada] = useState<EntradaAuditoriaConUsuario | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setEntradas(
        await listarAuditoria({
          tabla: tabla || undefined,
          desde: desde ? `${desde}T00:00:00` : undefined,
          hasta: hasta ? `${hasta}T23:59:59` : undefined,
        }),
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [tabla, desde, hasta]);

  useEffect(() => {
    const temporizador = setTimeout(recargar, 250);
    return () => clearTimeout(temporizador);
  }, [recargar]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField select label="Tabla" size="small" value={tabla} sx={{ minWidth: 180 }} onChange={(e) => setTabla(e.target.value)}>
          <MenuItem value="">Todas</MenuItem>
          {TABLAS_AUDITADAS.map((t) => (
            <MenuItem key={t} value={t}>
              {ETIQUETA_TABLA[t]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={desde}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => setDesde(e.target.value)}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={hasta}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => setHasta(e.target.value)}
        />
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
              <TableCell>Fecha</TableCell>
              <TableCell>Tabla</TableCell>
              <TableCell>Registro</TableCell>
              <TableCell>Acción</TableCell>
              <TableCell>Realizado por</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && entradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <HistoryIcon fontSize="large" />
                    <Typography variant="body2">No hay cambios registrados con estos filtros.</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {entradas.map((entrada) => (
              <TableRow key={entrada.id_bitacora} hover sx={{ cursor: 'pointer' }} onClick={() => setEntradaSeleccionada(entrada)}>
                <TableCell>{dayjs(entrada.fecha_hora).format('DD/MM/YYYY HH:mm:ss')}</TableCell>
                <TableCell>{ETIQUETA_TABLA[entrada.tabla] ?? entrada.tabla}</TableCell>
                <TableCell>{entrada.id_registro ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={entrada.accion === 'insert' ? 'Creación' : 'Modificación'}
                    color={entrada.accion === 'insert' ? 'success' : 'info'}
                  />
                </TableCell>
                <TableCell>
                  {entrada.usuario ? `${entrada.usuario.nombres} ${entrada.usuario.apellidos}` : 'Sistema (migración/seed)'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!entradaSeleccionada} onClose={() => setEntradaSeleccionada(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle del cambio</DialogTitle>
        <DialogContent dividers>
          {entradaSeleccionada && (
            <Stack spacing={2}>
              {entradaSeleccionada.valores_anteriores && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Antes
                  </Typography>
                  <Box
                    component="pre"
                    sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, fontSize: 12, overflow: 'auto', m: 0 }}
                  >
                    {JSON.stringify(entradaSeleccionada.valores_anteriores, null, 2)}
                  </Box>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {entradaSeleccionada.valores_anteriores ? 'Después' : 'Valores registrados'}
                </Typography>
                <Box
                  component="pre"
                  sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, fontSize: 12, overflow: 'auto', m: 0 }}
                >
                  {JSON.stringify(entradaSeleccionada.valores_nuevos, null, 2)}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
