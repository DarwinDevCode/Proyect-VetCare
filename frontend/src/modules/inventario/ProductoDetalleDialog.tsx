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
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import type { MovimientoConResponsable, Producto, TipoMovimiento, TipoProducto } from '../../types/dominio';
import { actualizarProducto, listarMovimientos, registrarMovimiento } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  producto: Producto | null;
  puedeGestionar: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

const ETIQUETA_TIPO_PRODUCTO: Record<TipoProducto, string> = {
  medicamento: 'Medicamento',
  insumo: 'Insumo',
  vacuna: 'Vacuna',
};

const ETIQUETA_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  ajuste: 'Ajuste',
  consumo: 'Consumo',
};

const MOVIMIENTO_VACIO = {
  tipo: 'ingreso' as 'ingreso' | 'ajuste',
  signoAjuste: null as 'aumentar' | 'disminuir' | null,
  cantidad: '',
  observacion: '',
  loteCodigo: '',
  fechaVencimiento: '',
};

function bajoMinimo(p: Producto): boolean {
  return p.existencia_actual <= p.nivel_minimo;
}

// RF-025 (consulta de existencias), RF-021/RF-022 (editar producto, registrar
// ingreso/ajuste -- exclusivo de Administrador) y RF-027 (historico de movimientos).
// Veterinario solo lee (RF-025 es de solo consulta para ese rol).
export function ProductoDetalleDialog({ producto, puedeGestionar, onCerrar, onActualizado }: Props) {
  const [editando, setEditando] = useState(false);
  const [registrandoMovimiento, setRegistrandoMovimiento] = useState(false);

  const [formEdicion, setFormEdicion] = useState({
    codigo: '',
    nombre: '',
    tipo: '' as TipoProducto | '',
    presentacion: '',
    unidadMedida: '',
    nivelMinimo: '',
    precioUnitario: '',
    intervaloDias: '',
    activo: true,
  });
  const [formMovimiento, setFormMovimiento] = useState(MOVIMIENTO_VACIO);

  const [movimientos, setMovimientos] = useState<MovimientoConResponsable[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  const [erroresEdicion, setErroresEdicion] = useState<Record<string, string>>({});
  const [erroresMovimiento, setErroresMovimiento] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!producto) return;
    setFormEdicion({
      codigo: producto.codigo,
      nombre: producto.nombre,
      tipo: producto.tipo,
      presentacion: producto.presentacion ?? '',
      unidadMedida: producto.unidad_medida,
      nivelMinimo: String(producto.nivel_minimo),
      precioUnitario: String(producto.precio_unitario),
      intervaloDias: producto.intervalo_dias !== null ? String(producto.intervalo_dias) : '',
      activo: producto.activo,
    });
    setFormMovimiento(MOVIMIENTO_VACIO);
    setEditando(false);
    setRegistrandoMovimiento(false);
    setErrorGeneral(null);

    setCargandoMovimientos(true);
    listarMovimientos(producto.id_producto)
      .then(setMovimientos)
      .finally(() => setCargandoMovimientos(false));
  }, [producto]);

  if (!producto) return null;

  async function recargarMovimientos() {
    const resultado = await listarMovimientos(producto!.id_producto);
    setMovimientos(resultado);
  }

  function validarEdicion(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!formEdicion.codigo.trim()) nuevosErrores.codigo = 'Obligatorio.';
    if (!formEdicion.nombre.trim()) nuevosErrores.nombre = 'Obligatorio.';
    if (!formEdicion.tipo) nuevosErrores.tipo = 'Selecciona un tipo.';
    if (!formEdicion.unidadMedida.trim()) nuevosErrores.unidadMedida = 'Obligatorio.';

    const nivelMinimo = Number(formEdicion.nivelMinimo);
    if (formEdicion.nivelMinimo.trim() === '' || Number.isNaN(nivelMinimo) || nivelMinimo < 0) {
      nuevosErrores.nivelMinimo = 'Debe ser un número mayor o igual a 0.';
    }
    const precioUnitario = Number(formEdicion.precioUnitario);
    if (formEdicion.precioUnitario.trim() === '' || Number.isNaN(precioUnitario) || precioUnitario < 0) {
      nuevosErrores.precioUnitario = 'Debe ser un número mayor o igual a 0.';
    }
    if (formEdicion.intervaloDias.trim() !== '') {
      const intervalo = Number(formEdicion.intervaloDias);
      if (!Number.isInteger(intervalo) || intervalo <= 0) {
        nuevosErrores.intervaloDias = 'Debe ser un número entero mayor a 0.';
      }
    }

    setErroresEdicion(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardarEdicion() {
    setErrorGeneral(null);
    if (!validarEdicion()) return;

    setGuardando(true);
    try {
      await actualizarProducto(producto!.id_producto, {
        codigo: formEdicion.codigo.trim(),
        nombre: formEdicion.nombre.trim(),
        tipo: formEdicion.tipo as TipoProducto,
        presentacion: formEdicion.presentacion.trim() || null,
        unidad_medida: formEdicion.unidadMedida.trim(),
        nivel_minimo: Number(formEdicion.nivelMinimo),
        precio_unitario: Number(formEdicion.precioUnitario),
        intervalo_dias:
          formEdicion.tipo === 'vacuna' && formEdicion.intervaloDias.trim() ? Number(formEdicion.intervaloDias) : null,
        activo: formEdicion.activo,
      });
      setEditando(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  function validarMovimiento(): boolean {
    const nuevosErrores: Record<string, string> = {};
    const cantidad = Number(formMovimiento.cantidad);
    // Estrictamente > 0: el campo siempre exige una magnitud positiva; el signo real
    // (ingreso siempre positivo, ajuste segun "aumentar"/"disminuir") se aplica despues,
    // nunca lo escribe el usuario directamente.
    if (formMovimiento.cantidad.trim() === '' || Number.isNaN(cantidad) || cantidad <= 0) {
      nuevosErrores.cantidad = 'Debe ser un número mayor a 0.';
    }
    if (formMovimiento.tipo === 'ajuste' && !formMovimiento.signoAjuste) {
      nuevosErrores.signoAjuste = 'Indica si aumenta o disminuye la existencia.';
    }
    setErroresMovimiento(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardarMovimiento() {
    setErrorGeneral(null);
    if (!validarMovimiento()) return;

    const cantidadNum = Number(formMovimiento.cantidad);
    const cantidadFirmada =
      formMovimiento.tipo === 'ajuste' && formMovimiento.signoAjuste === 'disminuir'
        ? -cantidadNum
        : cantidadNum;

    setGuardando(true);
    try {
      await registrarMovimiento({
        id_producto: producto!.id_producto,
        tipo_movimiento: formMovimiento.tipo,
        cantidad: cantidadFirmada,
        observacion: formMovimiento.observacion.trim() || null,
        ...(formMovimiento.tipo === 'ingreso'
          ? {
              lote_codigo: formMovimiento.loteCodigo.trim() || null,
              fecha_vencimiento: formMovimiento.fechaVencimiento || null,
            }
          : {}),
      });
      setFormMovimiento(MOVIMIENTO_VACIO);
      setRegistrandoMovimiento(false);
      await recargarMovimientos();
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  const alerta = bajoMinimo(producto);
  const puedeRegistrarMovimiento = puedeGestionar && producto.activo;

  return (
    <Dialog open={!!producto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        {producto.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={ETIQUETA_TIPO_PRODUCTO[producto.tipo]} size="small" variant="outlined" />
            {!producto.activo && <Chip label="Inactivo" size="small" />}
            {alerta && <Chip label="Bajo mínimo" size="small" color="warning" />}
          </Stack>

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Datos del producto</Typography>
              {puedeGestionar && !editando && (
                <IconButton size="small" onClick={() => setEditando(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            {editando ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Código"
                    fullWidth
                    value={formEdicion.codigo}
                    error={!!erroresEdicion.codigo}
                    helperText={erroresEdicion.codigo}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, codigo: e.target.value }))}
                  />
                  <TextField
                    label="Nombre"
                    fullWidth
                    value={formEdicion.nombre}
                    error={!!erroresEdicion.nombre}
                    helperText={erroresEdicion.nombre}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="body2" color={erroresEdicion.tipo ? 'error' : 'text.secondary'}>
                    Tipo
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={formEdicion.tipo}
                    onChange={(_, val) => val && setFormEdicion((f) => ({ ...f, tipo: val }))}
                  >
                    <ToggleButton value="medicamento">Medicamento</ToggleButton>
                    <ToggleButton value="insumo">Insumo</ToggleButton>
                    <ToggleButton value="vacuna">Vacuna</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Unidad de medida"
                    fullWidth
                    value={formEdicion.unidadMedida}
                    error={!!erroresEdicion.unidadMedida}
                    helperText={erroresEdicion.unidadMedida}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, unidadMedida: e.target.value }))}
                  />
                  <TextField
                    label="Presentación"
                    fullWidth
                    value={formEdicion.presentacion}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, presentacion: e.target.value }))}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Nivel mínimo"
                    type="number"
                    fullWidth
                    value={formEdicion.nivelMinimo}
                    error={!!erroresEdicion.nivelMinimo}
                    helperText={erroresEdicion.nivelMinimo}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, nivelMinimo: e.target.value }))}
                  />
                  <TextField
                    label="Precio unitario"
                    type="number"
                    fullWidth
                    value={formEdicion.precioUnitario}
                    error={!!erroresEdicion.precioUnitario}
                    helperText={erroresEdicion.precioUnitario}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, precioUnitario: e.target.value }))}
                  />
                </Stack>

                {formEdicion.tipo === 'vacuna' && (
                  <TextField
                    label="Intervalo entre dosis (días, opcional)"
                    type="number"
                    fullWidth
                    value={formEdicion.intervaloDias}
                    error={!!erroresEdicion.intervaloDias}
                    helperText={erroresEdicion.intervaloDias}
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    onChange={(e) => setFormEdicion((f) => ({ ...f, intervaloDias: e.target.value }))}
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={formEdicion.activo}
                      onChange={(e) => setFormEdicion((f) => ({ ...f, activo: e.target.checked }))}
                    />
                  }
                  label={formEdicion.activo ? 'Activo' : 'Inactivo'}
                />

                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditando(false)} disabled={guardando}>
                    Cancelar
                  </Button>
                  <Button variant="contained" onClick={guardarEdicion} loading={guardando}>
                    Guardar
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Código: {producto.codigo} · Unidad: {producto.unidad_medida}
                  {producto.presentacion ? ` · ${producto.presentacion}` : ''}
                </Typography>
                <Typography variant="body2" color={alerta ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: alerta ? 600 : 400 }}>
                  Existencia actual: {producto.existencia_actual} (nivel mínimo: {producto.nivel_minimo})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Precio unitario: ${producto.precio_unitario.toFixed(2)}
                </Typography>
                {producto.tipo === 'vacuna' && producto.intervalo_dias !== null && (
                  <Typography variant="body2" color="text.secondary">
                    Intervalo entre dosis: {producto.intervalo_dias} días
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Movimientos
            </Typography>

            {registrandoMovimiento && (
              <Stack spacing={2} sx={{ mb: 2 }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={formMovimiento.tipo}
                  onChange={(_, val) =>
                    val && setFormMovimiento((f) => ({ ...f, tipo: val, signoAjuste: null }))
                  }
                >
                  <ToggleButton value="ingreso">Ingreso</ToggleButton>
                  <ToggleButton value="ajuste">Ajuste</ToggleButton>
                </ToggleButtonGroup>

                {formMovimiento.tipo === 'ajuste' && (
                  <Stack spacing={0.5}>
                    <Typography
                      variant="body2"
                      color={erroresMovimiento.signoAjuste ? 'error' : 'text.secondary'}
                    >
                      ¿Aumenta o disminuye la existencia?
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={formMovimiento.signoAjuste}
                      onChange={(_, val) => val && setFormMovimiento((f) => ({ ...f, signoAjuste: val }))}
                    >
                      <ToggleButton value="aumentar">Aumentar</ToggleButton>
                      <ToggleButton value="disminuir">Disminuir</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Cantidad"
                    type="number"
                    fullWidth
                    value={formMovimiento.cantidad}
                    error={!!erroresMovimiento.cantidad}
                    helperText={erroresMovimiento.cantidad}
                    slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                    onChange={(e) => setFormMovimiento((f) => ({ ...f, cantidad: e.target.value }))}
                  />
                  <TextField
                    label="Observación (opcional)"
                    fullWidth
                    value={formMovimiento.observacion}
                    slotProps={{ htmlInput: { maxLength: 150 } }}
                    onChange={(e) => setFormMovimiento((f) => ({ ...f, observacion: e.target.value }))}
                  />
                </Stack>

                {formMovimiento.tipo === 'ingreso' && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Lote (opcional)"
                      fullWidth
                      value={formMovimiento.loteCodigo}
                      slotProps={{ htmlInput: { maxLength: 30 } }}
                      onChange={(e) => setFormMovimiento((f) => ({ ...f, loteCodigo: e.target.value }))}
                    />
                    <TextField
                      label="Fecha de vencimiento (opcional)"
                      type="date"
                      fullWidth
                      value={formMovimiento.fechaVencimiento}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(e) => setFormMovimiento((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                    />
                  </Stack>
                )}

                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    onClick={() => {
                      setRegistrandoMovimiento(false);
                      setFormMovimiento(MOVIMIENTO_VACIO);
                    }}
                    disabled={guardando}
                  >
                    Cancelar
                  </Button>
                  <Button variant="contained" onClick={guardarMovimiento} loading={guardando}>
                    Guardar movimiento
                  </Button>
                </Stack>
              </Stack>
            )}

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Cantidad</TableCell>
                    <TableCell>Existencia resultante</TableCell>
                    <TableCell>Lote / Vencimiento</TableCell>
                    <TableCell>Responsable</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!cargandoMovimientos && movimientos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          Sin movimientos registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {movimientos.map((m) => {
                    const porVencer =
                      !!m.fecha_vencimiento && dayjs(m.fecha_vencimiento).diff(dayjs(), 'day') <= 30;
                    return (
                      <TableRow key={m.id_movimiento}>
                        <TableCell>{dayjs(m.fecha_hora).format('DD/MM/YYYY HH:mm')}</TableCell>
                        <TableCell>
                          <Chip label={ETIQUETA_TIPO_MOVIMIENTO[m.tipo_movimiento]} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                        </TableCell>
                        <TableCell>{m.existencia_resultante}</TableCell>
                        <TableCell>
                          {m.lote_codigo || m.fecha_vencimiento ? (
                            <Stack spacing={0.25}>
                              {m.lote_codigo && (
                                <Typography variant="body2">{m.lote_codigo}</Typography>
                              )}
                              {m.fecha_vencimiento && (
                                <Chip
                                  label={`Vence ${dayjs(m.fecha_vencimiento).format('DD/MM/YYYY')}`}
                                  size="small"
                                  color={porVencer ? 'warning' : 'default'}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {m.usuario.nombres} {m.usuario.apellidos}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {puedeRegistrarMovimiento && !editando && !registrandoMovimiento && (
          <Button onClick={() => setRegistrandoMovimiento(true)}>Registrar movimiento</Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
