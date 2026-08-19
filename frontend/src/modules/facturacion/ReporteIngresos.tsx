import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import PrintIcon from '@mui/icons-material/Print';
import dayjs from 'dayjs';
import type { FormaPago } from '../../types/dominio';
import { listarPagosDelPeriodo, type PagoDeReporte } from './api';
import { mensajeError } from '../../lib/errors';
import { ETIQUETA_FORMA_PAGO, formatoMoneda } from './formato';

const FORMAS: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia'];

// RF-032: reporte consolidado de los ingresos de un rango de fechas. "Ingreso" es
// dinero efectivamente cobrado, no facturado: una factura emitida y no cobrada no
// es un ingreso, y RN-015 admite cobrar una factura en varios pagos y en fechas
// distintas a la de emision. Exclusivo de Administrador (matriz 3.8).
export function ReporteIngresos() {
  const [desde, setDesde] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [hasta, setHasta] = useState(dayjs().format('YYYY-MM-DD'));
  const [pagos, setPagos] = useState<PagoDeReporte[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPagos(await listarPagosDelPeriodo(desde, hasta));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  // La consolidacion se hace en memoria: es una suma sobre filas que el rol ya
  // puede leer, no una regla de negocio que deba vivir en la base.
  const resumen = useMemo(() => {
    const porForma = FORMAS.map((forma) => {
      const delGrupo = pagos.filter((p) => p.forma_pago === forma);
      return {
        forma,
        cantidad: delGrupo.length,
        monto: delGrupo.reduce((suma, p) => suma + Number(p.monto), 0),
      };
    });
    return {
      porForma,
      total: pagos.reduce((suma, p) => suma + Number(p.monto), 0),
      facturas: new Set(pagos.map((p) => p.id_factura)).size,
    };
  }, [pagos]);

  return (
    <Box id="reporte-ingresos">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'center' }, displayPrint: 'none' }}
      >
        <TextField
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button startIcon={<PrintIcon />} sx={{ ml: { sm: 'auto' } }} onClick={() => window.print()}>
          Imprimir o guardar PDF
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        Ingresos del {dayjs(desde).format('DD/MM/YYYY')} al {dayjs(hasta).format('DD/MM/YYYY')}
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
          {resumen.porForma.map((fila) => (
            <Box key={fila.forma}>
              <Typography variant="body2" color="text.secondary">
                {ETIQUETA_FORMA_PAGO[fila.forma]} ({fila.cantidad})
              </Typography>
              <Typography variant="h6">{formatoMoneda(fila.monto)}</Typography>
            </Box>
          ))}
          <Box sx={{ ml: { sm: 'auto' }, textAlign: { sm: 'right' } }}>
            <Typography variant="body2" color="text.secondary">
              Total cobrado ({resumen.facturas} factura{resumen.facturas === 1 ? '' : 's'})
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatoMoneda(resumen.total)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Factura</TableCell>
              <TableCell>Forma de pago</TableCell>
              <TableCell>Referencia</TableCell>
              <TableCell align="right">Monto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && pagos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    No se registraron cobros en ese período.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {pagos.map((pago) => (
              <TableRow key={pago.id_pago}>
                <TableCell>{dayjs(pago.fecha_pago).format('DD/MM/YYYY HH:mm')}</TableCell>
                <TableCell>{pago.factura.numero}</TableCell>
                <TableCell>{ETIQUETA_FORMA_PAGO[pago.forma_pago]}</TableCell>
                <TableCell>{pago.referencia ?? '—'}</TableCell>
                <TableCell align="right">{formatoMoneda(pago.monto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
