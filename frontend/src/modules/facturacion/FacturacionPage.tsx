import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import dayjs from 'dayjs';
import type { EstadoCobro, FacturaListada } from '../../types/dominio';
import { listarFacturas, type FiltrosFactura } from './api';
import { mensajeError } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { COLOR_ESTADO_COBRO, ETIQUETA_ESTADO_COBRO, formatoMoneda } from './formato';
import { NuevaFacturaDialog } from './NuevaFacturaDialog';
import { FacturaDetalleDialog } from './FacturaDetalleDialog';
import { ReporteIngresos } from './ReporteIngresos';

const ESTADOS: EstadoCobro[] = ['pendiente', 'parcial', 'pagada'];

const FILTROS_INICIALES: FiltrosFactura = {
  desde: null,
  hasta: null,
  propietario: '',
  estadoCobro: '',
};

// RF-028 a RF-032. La matriz 3.8 reparte este modulo entre dos roles: Recepcion
// emite y cobra (RF-028, RF-030), Administracion reporta (RF-032), y ambos
// consultan (RF-031). Por eso la pestana de reporte y los botones de escritura son
// condicionales -- pero la garantia real es del servidor: fn_emitir_factura
// comprueba el rol y las politicas de `pago` solo admiten Recepcion.
export function FacturacionPage() {
  const { sesion } = useAuth();
  const puedeFacturar = sesion?.rol.codigo === 'recepcionista';
  const puedeReportar = sesion?.rol.codigo === 'administrador';

  const [pestana, setPestana] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosFactura>(FILTROS_INICIALES);
  const [facturas, setFacturas] = useState<FacturaListada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevaAbierto, setDialogoNuevaAbierto] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaListada | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarFacturas(filtros);
      setFacturas(resultado);
      // Si el detalle esta abierto, se refresca con los datos nuevos -- el saldo y
      // el estado de cobro cambian al registrar un pago (mismo patron que
      // InventarioPage tras editar un producto).
      setFacturaSeleccionada((actual) =>
        actual ? resultado.find((f) => f.id_factura === actual.id_factura) ?? actual : null,
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    const temporizador = setTimeout(recargar, 300);
    return () => clearTimeout(temporizador);
  }, [recargar]);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1, displayPrint: 'none' }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Facturación y Reportes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprobantes emitidos, cobros registrados e ingresos del período.
          </Typography>
        </Box>
        {puedeFacturar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogoNuevaAbierto(true)}>
            Emitir factura
          </Button>
        )}
      </Stack>

      {puedeReportar && (
        <Tabs
          value={pestana}
          onChange={(_e, valor: number) => setPestana(valor)}
          sx={{ mb: 3, displayPrint: 'none' }}
        >
          <Tab label="Facturas emitidas" />
          <Tab label="Reporte de ingresos" />
        </Tabs>
      )}

      {puedeReportar && pestana === 1 ? (
        <ReporteIngresos />
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 2, displayPrint: 'none' }}
          >
            <TextField
              label="Desde"
              type="date"
              value={filtros.desde ?? ''}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value || null }))}
            />
            <TextField
              label="Hasta"
              type="date"
              value={filtros.hasta ?? ''}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value || null }))}
            />
            <TextField
              label="Propietario"
              placeholder="Nombre, apellido o cédula"
              value={filtros.propietario}
              sx={{ minWidth: 240 }}
              onChange={(e) => setFiltros((f) => ({ ...f, propietario: e.target.value }))}
            />
            <TextField
              select
              label="Situación de cobro"
              value={filtros.estadoCobro}
              sx={{ minWidth: 190 }}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, estadoCobro: e.target.value as EstadoCobro | '' }))
              }
            >
              <MenuItem value="">Todas</MenuItem>
              {ESTADOS.map((estado) => (
                <MenuItem key={estado} value={estado}>
                  {ETIQUETA_ESTADO_COBRO[estado]}
                </MenuItem>
              ))}
            </TextField>
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
                  <TableCell>Número</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Propietario</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  <TableCell>Situación</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!cargando && facturas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                        <ReceiptLongIcon fontSize="large" />
                        <Typography variant="body2">
                          No hay facturas que coincidan con los filtros.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
                {facturas.map((factura) => (
                  <TableRow
                    key={factura.id_factura}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setFacturaSeleccionada(factura)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {factura.numero}
                      </Typography>
                    </TableCell>
                    <TableCell>{dayjs(factura.fecha_emision).format('DD/MM/YYYY HH:mm')}</TableCell>
                    <TableCell>
                      {factura.propietario.nombres} {factura.propietario.apellidos}
                    </TableCell>
                    <TableCell align="right">{formatoMoneda(factura.total)}</TableCell>
                    <TableCell align="right">{formatoMoneda(factura.saldo_pendiente)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ETIQUETA_ESTADO_COBRO[factura.estado_cobro]}
                        color={COLOR_ESTADO_COBRO[factura.estado_cobro]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <NuevaFacturaDialog
        abierto={dialogoNuevaAbierto}
        onCerrar={() => setDialogoNuevaAbierto(false)}
        onEmitida={recargar}
      />
      <FacturaDetalleDialog
        factura={facturaSeleccionada}
        puedeCobrar={puedeFacturar}
        onCerrar={() => setFacturaSeleccionada(null)}
        onPagoRegistrado={recargar}
      />
    </Box>
  );
}
