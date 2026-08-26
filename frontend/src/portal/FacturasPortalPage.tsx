import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import dayjs from 'dayjs';
import type { DetalleFactura, EstadoFactura, Pago } from '../types/dominio';
import { listarDetalleFactura, listarMisFacturas, listarPagosFactura } from './api';
import { mensajeError } from '../lib/errors';
import { ETIQUETA_ESTADO_COBRO, ETIQUETA_FORMA_PAGO, COLOR_ESTADO_COBRO, formatoMoneda } from '../modules/facturacion/formato';
import { usePortalAuth } from './PortalAuthContext';

// RF-045: mis facturas, solo lectura -- el portal nunca cobra ni emite.
export function FacturasPortalPage() {
  const { sesion } = usePortalAuth();
  const theme = useTheme();
  const esMovil = useMediaQuery(theme.breakpoints.down('sm'));
  const [facturas, setFacturas] = useState<EstadoFactura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seleccionada, setSeleccionada] = useState<EstadoFactura | null>(null);
  const [detalle, setDetalle] = useState<DetalleFactura[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);

  useEffect(() => {
    listarMisFacturas()
      .then(setFacturas)
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!seleccionada) return;
    Promise.all([listarDetalleFactura(seleccionada.id_factura), listarPagosFactura(seleccionada.id_factura)])
      .then(([d, p]) => {
        setDetalle(d);
        setPagos(p);
      })
      .catch(() => {
        setDetalle([]);
        setPagos([]);
      });
  }, [seleccionada]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Mis facturas
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!cargando && facturas.length === 0 && (
        <Paper variant="outlined" sx={{ py: 6 }}>
          <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <ReceiptLongIcon fontSize="large" />
            <Typography variant="body2">Todavía no tienes facturas registradas.</Typography>
          </Stack>
        </Paper>
      )}

      {facturas.length > 0 &&
        (esMovil ? (
          <Stack spacing={1.5}>
            {facturas.map((f) => (
              <Card key={f.id_factura} variant="outlined" onClick={() => setSeleccionada(f)} sx={{ cursor: 'pointer' }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {f.numero}
                    </Typography>
                    <Chip label={ETIQUETA_ESTADO_COBRO[f.estado_cobro]} size="small" color={COLOR_ESTADO_COBRO[f.estado_cobro]} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {dayjs(f.fecha_emision).format('DD/MM/YYYY')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {formatoMoneda(f.total)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Número</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {facturas.map((f) => (
                  <TableRow key={f.id_factura} hover sx={{ cursor: 'pointer' }} onClick={() => setSeleccionada(f)}>
                    <TableCell>{f.numero}</TableCell>
                    <TableCell>{dayjs(f.fecha_emision).format('DD/MM/YYYY')}</TableCell>
                    <TableCell align="right">{formatoMoneda(f.total)}</TableCell>
                    <TableCell>
                      <Chip label={ETIQUETA_ESTADO_COBRO[f.estado_cobro]} size="small" color={COLOR_ESTADO_COBRO[f.estado_cobro]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ))}

      <Dialog open={!!seleccionada} onClose={() => setSeleccionada(null)} maxWidth="sm" fullWidth fullScreen={esMovil}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', displayPrint: 'none' }}>
          Factura {seleccionada?.numero}
          <IconButton sx={{ ml: 'auto' }} onClick={() => setSeleccionada(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* RI-005, mismo mecanismo que FacturaDetalleDialog.tsx (staff):
                window.print() + el bloque #comprobante-factura que la hoja
                @media print de index.css ya oculta/aisla -- reutiliza el mismo
                id, no hace falta CSS nuevo. */}
            <Box id="comprobante-factura">
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', mb: 2 }}
              >
                <Box>
                  <Typography variant="h6">VetCare — Comprobante de atención</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Factura {seleccionada?.numero}
                    {seleccionada ? ` · ${dayjs(seleccionada.fecha_emision).format('DD/MM/YYYY HH:mm')}` : ''}
                  </Typography>
                </Box>
                {sesion && (
                  <Box sx={{ textAlign: { sm: 'right' } }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {sesion.propietario.nombres} {sesion.propietario.apellidos}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {sesion.propietario.identificacion}
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* 4 columnas numericas no entran en el ancho de un dialogo movil sin
                  achicar la letra hasta ilegible -- se deja scroll horizontal propio
                  en vez de reestructurar esta tabla secundaria en tarjetas. */}
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Concepto</TableCell>
                      <TableCell align="right">Cant.</TableCell>
                      <TableCell align="right">Precio</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
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
              </Box>

              {seleccionada && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    Subtotal: {formatoMoneda(seleccionada.subtotal)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Impuesto: {formatoMoneda(seleccionada.impuesto)}
                  </Typography>
                  <Typography variant="h6">Total: {formatoMoneda(seleccionada.total)}</Typography>
                  <Typography variant="body2" color={seleccionada.saldo_pendiente > 0 ? 'warning.main' : 'success.main'}>
                    Saldo pendiente: {formatoMoneda(seleccionada.saldo_pendiente)}
                  </Typography>
                </Box>
              )}
            </Box>

            {pagos.length > 0 && (
              <Box sx={{ displayPrint: 'none' }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2">Pagos registrados</Typography>
                <Stack spacing={0.5}>
                  {pagos.map((p) => (
                    <Typography key={p.id_pago} variant="body2" color="text.secondary">
                      {dayjs(p.fecha_pago).format('DD/MM/YYYY')} · {ETIQUETA_FORMA_PAGO[p.forma_pago]} ·{' '}
                      {formatoMoneda(p.monto)}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ displayPrint: 'none' }}>
          <Button startIcon={<PrintIcon />} onClick={() => window.print()}>
            Imprimir o guardar PDF
          </Button>
          <Button onClick={() => setSeleccionada(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
