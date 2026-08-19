import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import PaymentsIcon from '@mui/icons-material/Payments';
import dayjs from 'dayjs';
import type { DetalleFactura, FacturaListada, Pago } from '../../types/dominio';
import { listarDetalle, listarPagos } from './api';
import { mensajeError } from '../../lib/errors';
import {
  COLOR_ESTADO_COBRO,
  ETIQUETA_ESTADO_COBRO,
  ETIQUETA_FORMA_PAGO,
  formatoMoneda,
} from './formato';
import { RegistrarPagoDialog } from './RegistrarPagoDialog';

interface Props {
  factura: FacturaListada | null;
  puedeCobrar: boolean;
  onCerrar: () => void;
  onPagoRegistrado: () => void;
}

// RF-031: detalle de la factura y su saldo pendiente. RF-030: registrar cobros
// sobre ella. RI-005: imprimir o exportar el comprobante para el propietario.
export function FacturaDetalleDialog({ factura, puedeCobrar, onCerrar, onPagoRegistrado }: Props) {
  const [detalle, setDetalle] = useState<DetalleFactura[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogoPagoAbierto, setDialogoPagoAbierto] = useState(false);

  const idFactura = factura?.id_factura ?? null;

  const recargar = useCallback(async () => {
    if (idFactura === null) return;
    setError(null);
    try {
      const [lineas, cobros] = await Promise.all([listarDetalle(idFactura), listarPagos(idFactura)]);
      setDetalle(lineas);
      setPagos(cobros);
    } catch (err) {
      setError(mensajeError(err));
    }
  }, [idFactura]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  if (!factura) return null;

  // RI-005: se imprime desde el navegador (window.print) y la hoja de estilos de
  // impresion de index.css oculta todo salvo este bloque. No se genera un PDF con
  // una libreria: el propio dialogo de impresion del navegador ya permite
  // "Guardar como PDF", que cubre tanto "imprimir" como "exportar" sin agregar una
  // dependencia ni un segundo formato que mantener.
  const imprimir = () => window.print();

  const totalmentePagada = Number(factura.saldo_pendiente) <= 0;

  return (
    <>
      <Dialog open onClose={onCerrar} maxWidth="md" fullWidth>
        <DialogTitle sx={{ displayPrint: 'none' }}>Factura {factura.numero}</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box id="comprobante-factura">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between', mb: 2 }}
            >
              <Box>
                <Typography variant="h6">VetCare — Comprobante de atención</Typography>
                <Typography variant="body2" color="text.secondary">
                  Factura {factura.numero} · {dayjs(factura.fecha_emision).format('DD/MM/YYYY HH:mm')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { sm: 'right' } }}>
                {/* RN-012: el titular del cobro es el propietario. */}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {factura.propietario.nombres} {factura.propietario.apellidos}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {factura.propietario.identificacion}
                </Typography>
              </Box>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Concepto</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  <TableCell align="right">Importe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detalle.map((linea) => (
                  <TableRow key={linea.id_detalle}>
                    <TableCell>{linea.descripcion}</TableCell>
                    <TableCell align="right">{linea.cantidad}</TableCell>
                    <TableCell align="right">{formatoMoneda(linea.precio_unitario)}</TableCell>
                    <TableCell align="right">{formatoMoneda(linea.subtotal_linea)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="body2">Subtotal: {formatoMoneda(factura.subtotal)}</Typography>
              <Typography variant="body2">Impuesto: {formatoMoneda(factura.impuesto)}</Typography>
              <Typography variant="h6">Total: {formatoMoneda(factura.total)}</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2, displayPrint: 'none' }} />

          <Box sx={{ displayPrint: 'none' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Cobros
              </Typography>
              <Chip
                size="small"
                label={ETIQUETA_ESTADO_COBRO[factura.estado_cobro]}
                color={COLOR_ESTADO_COBRO[factura.estado_cobro]}
              />
            </Stack>

            {pagos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Todavía no se ha registrado ningún cobro.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Forma de pago</TableCell>
                    <TableCell>Referencia</TableCell>
                    <TableCell align="right">Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagos.map((pago) => (
                    <TableRow key={pago.id_pago}>
                      <TableCell>{dayjs(pago.fecha_pago).format('DD/MM/YYYY HH:mm')}</TableCell>
                      <TableCell>{ETIQUETA_FORMA_PAGO[pago.forma_pago]}</TableCell>
                      <TableCell>{pago.referencia ?? '—'}</TableCell>
                      <TableCell align="right">{formatoMoneda(pago.monto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Box sx={{ mt: 1, textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Pagado: {formatoMoneda(factura.total_pagado)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Saldo pendiente: {formatoMoneda(factura.saldo_pendiente)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ displayPrint: 'none' }}>
          <Button startIcon={<PrintIcon />} onClick={imprimir}>
            Imprimir o guardar PDF
          </Button>
          {puedeCobrar && !totalmentePagada && (
            <Button
              variant="contained"
              startIcon={<PaymentsIcon />}
              onClick={() => setDialogoPagoAbierto(true)}
            >
              Registrar cobro
            </Button>
          )}
          <Button onClick={onCerrar}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <RegistrarPagoDialog
        idFactura={factura.id_factura}
        saldoPendiente={Number(factura.saldo_pendiente)}
        abierto={dialogoPagoAbierto}
        onCerrar={() => setDialogoPagoAbierto(false)}
        onRegistrado={() => {
          recargar();
          onPagoRegistrado();
        }}
      />
    </>
  );
}
