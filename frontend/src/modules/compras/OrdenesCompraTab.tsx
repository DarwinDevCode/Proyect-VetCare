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
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import dayjs from 'dayjs';
import type { EstadoOrdenCompra, Proveedor } from '../../types/dominio';
import { listarOrdenesCompra, type OrdenCompraConProveedor } from './api';
import { mensajeError } from '../../lib/errors';
import { NuevaOrdenCompraDialog } from './NuevaOrdenCompraDialog';
import { OrdenCompraDetalleDialog } from './OrdenCompraDetalleDialog';

interface Props {
  proveedores: Proveedor[];
}

const ETIQUETA_ESTADO: Record<EstadoOrdenCompra, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
};

const COLOR_ESTADO: Record<EstadoOrdenCompra, 'default' | 'primary' | 'success' | 'error'> = {
  borrador: 'default',
  emitida: 'primary',
  recibida: 'success',
  cancelada: 'error',
};

type FiltroEstado = 'todas' | EstadoOrdenCompra;
const OPCIONES_FILTRO: FiltroEstado[] = ['todas', 'borrador', 'emitida', 'recibida', 'cancelada'];
const ETIQUETA_FILTRO: Record<FiltroEstado, string> = { todas: 'Todas', ...ETIQUETA_ESTADO };

// RF-037/038/039: listado de órdenes de compra con su ciclo de vida.
export function OrdenesCompraTab({ proveedores }: Props) {
  const [ordenes, setOrdenes] = useState<OrdenCompraConProveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');

  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompraConProveedor | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarOrdenesCompra();
      setOrdenes(resultado);
      setOrdenSeleccionada((actual) =>
        actual ? resultado.find((o) => o.id_orden_compra === actual.id_orden_compra) ?? null : null,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const proveedoresActivos = useMemo(() => proveedores.filter((p) => p.activo), [proveedores]);

  const ordenesFiltradas = useMemo(
    () => (filtroEstado === 'todas' ? ordenes : ordenes.filter((o) => o.estado === filtroEstado)),
    [ordenes, filtroEstado],
  );

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
      >
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {OPCIONES_FILTRO.map((opcion) => (
            <Chip
              key={opcion}
              label={ETIQUETA_FILTRO[opcion]}
              size="small"
              color={filtroEstado === opcion ? 'primary' : 'default'}
              variant={filtroEstado === opcion ? 'filled' : 'outlined'}
              onClick={() => setFiltroEstado(opcion)}
            />
          ))}
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogoNuevaAbierto(true)}>
          Nueva orden
        </Button>
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
              <TableCell>#</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && ordenesFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <ShoppingCartIcon fontSize="large" />
                    <Typography variant="body2">
                      {filtroEstado !== 'todas'
                        ? 'Sin resultados para ese estado.'
                        : 'Todavía no hay órdenes de compra registradas.'}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {ordenesFiltradas.map((orden) => (
              <TableRow
                key={orden.id_orden_compra}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setOrdenSeleccionada(orden)}
              >
                <TableCell>#{orden.id_orden_compra}</TableCell>
                <TableCell>{orden.proveedor.nombre}</TableCell>
                <TableCell>{dayjs(orden.fecha_registro).format('DD/MM/YYYY HH:mm')}</TableCell>
                <TableCell>
                  <Chip label={ETIQUETA_ESTADO[orden.estado]} size="small" color={COLOR_ESTADO[orden.estado]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <NuevaOrdenCompraDialog
        abierto={dialogoNuevaAbierto}
        proveedores={proveedoresActivos}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        onCreada={recargar}
      />

      <OrdenCompraDetalleDialog
        orden={ordenSeleccionada}
        onCerrar={() => setOrdenSeleccionada(null)}
        onActualizada={recargar}
      />
    </Box>
  );
}
