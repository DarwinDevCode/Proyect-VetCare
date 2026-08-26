import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import type { EstadoOrdenCompra } from '../../types/dominio';
import { actualizarEstadoOrdenCompra, listarDetalleOrdenCompra, type DetalleOrdenCompraConProducto, type OrdenCompraConProveedor } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  orden: OrdenCompraConProveedor | null;
  onCerrar: () => void;
  onActualizada: () => void;
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

// RF-038/RF-039: transiciones de estado de una orden. 'recibida' es la unica que
// dispara efectos reales (RN-022, fn_recibir_orden_compra) -- este dialogo solo
// cambia el estado, nunca toca movimiento_inventario directamente.
export function OrdenCompraDetalleDialog({ orden, onCerrar, onActualizada }: Props) {
  const [detalle, setDetalle] = useState<DetalleOrdenCompraConProducto[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (!orden) return;
    setErrorGeneral(null);
    setCargandoDetalle(true);
    listarDetalleOrdenCompra(orden.id_orden_compra)
      .then(setDetalle)
      .catch((err) => setErrorGeneral(mensajeError(err)))
      .finally(() => setCargandoDetalle(false));
  }, [orden]);

  if (!orden) return null;

  async function cambiarEstado(estado: EstadoOrdenCompra) {
    setCambiando(true);
    setErrorGeneral(null);
    try {
      await actualizarEstadoOrdenCompra(orden!.id_orden_compra, estado);
      onActualizada();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setCambiando(false);
    }
  }

  const total = detalle.reduce((suma, d) => suma + d.subtotal_linea, 0);

  return (
    <Dialog open={!!orden} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Orden #{orden.id_orden_compra} · {orden.proveedor.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Box>
            <Chip label={ETIQUETA_ESTADO[orden.estado]} color={COLOR_ESTADO[orden.estado]} size="small" sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Registrada el {dayjs(orden.fecha_registro).format('DD/MM/YYYY HH:mm')}
            </Typography>
            {orden.observacion && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {orden.observacion}
              </Typography>
            )}
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Precio</TableCell>
                <TableCell align="right">Subtotal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!cargandoDetalle && detalle.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Sin líneas registradas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {detalle.map((linea) => (
                <TableRow key={linea.id_detalle}>
                  <TableCell>{linea.producto.nombre}</TableCell>
                  <TableCell align="right">
                    {linea.cantidad} {linea.producto.unidad_medida}
                  </TableCell>
                  <TableCell align="right">${linea.precio_unitario.toFixed(2)}</TableCell>
                  <TableCell align="right">${linea.subtotal_linea.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="h6" sx={{ textAlign: 'right' }}>
            Total: ${total.toFixed(2)}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {orden.estado === 'borrador' && (
          <>
            <Button color="error" onClick={() => cambiarEstado('cancelada')} loading={cambiando}>
              Cancelar orden
            </Button>
            <Button variant="contained" onClick={() => cambiarEstado('emitida')} loading={cambiando}>
              Emitir al proveedor
            </Button>
          </>
        )}
        {orden.estado === 'emitida' && (
          <>
            <Button color="error" onClick={() => cambiarEstado('cancelada')} loading={cambiando}>
              Cancelar orden
            </Button>
            <Button variant="contained" onClick={() => cambiarEstado('recibida')} loading={cambiando}>
              Marcar como recibida
            </Button>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
