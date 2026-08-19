import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import type { ConceptoFacturable, Propietario } from '../../types/dominio';
import { PropietarioAutocomplete } from '../pacientes/PropietarioAutocomplete';
import {
  emitirFactura,
  listarAtencionesFacturables,
  obtenerConceptosDeAtencion,
  type AtencionFacturable,
} from './api';
import { mensajeError } from '../../lib/errors';
import { PORCENTAJE_IMPUESTO_POR_DEFECTO, formatoMoneda } from './formato';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onEmitida: (idFactura: number) => void;
}

type Origen = 'atencion' | 'servicios';

interface LineaServicio {
  descripcion: string;
  cantidad: string;
  precio: string;
}

const LINEA_VACIA: LineaServicio = { descripcion: '', cantidad: '1', precio: '' };

// RF-028: emitir una factura, sea recuperando los conceptos de una atencion o
// cobrando servicios sueltos. La emision es una sola llamada RPC transaccional --
// esta pantalla nunca inserta la cabecera y las lineas por separado.
export function NuevaFacturaDialog({ abierto, onCerrar, onEmitida }: Props) {
  const [origen, setOrigen] = useState<Origen>('atencion');

  const [atenciones, setAtenciones] = useState<AtencionFacturable[]>([]);
  const [idConsulta, setIdConsulta] = useState<number | ''>('');
  const [conceptos, setConceptos] = useState<ConceptoFacturable[]>([]);
  const [cargandoConceptos, setCargandoConceptos] = useState(false);

  // RN-012: la factura se emite a nombre del propietario. Cuando se cobra una
  // atencion, el servidor lo deriva de ella; cuando se cobran servicios sueltos no
  // hay atencion de la que derivarlo, asi que hay que preguntarlo.
  const [propietario, setPropietario] = useState<Propietario | null>(null);
  const [lineas, setLineas] = useState<LineaServicio[]>([{ ...LINEA_VACIA }]);
  const [impuesto, setImpuesto] = useState(String(PORCENTAJE_IMPUESTO_POR_DEFECTO));

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Se recarga en cada apertura: entre una emision y la siguiente, la atencion que
  // se acaba de facturar ya no debe aparecer en la lista (RN-013).
  useEffect(() => {
    if (!abierto) return;
    setOrigen('atencion');
    setIdConsulta('');
    setConceptos([]);
    setPropietario(null);
    setLineas([{ ...LINEA_VACIA }]);
    setImpuesto(String(PORCENTAJE_IMPUESTO_POR_DEFECTO));
    setErrores({});
    setErrorGeneral(null);
    listarAtencionesFacturables()
      .then(setAtenciones)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto]);

  useEffect(() => {
    if (!idConsulta) {
      setConceptos([]);
      return;
    }
    setCargandoConceptos(true);
    obtenerConceptosDeAtencion(idConsulta as number)
      .then(setConceptos)
      .catch((err) => setErrorGeneral(mensajeError(err)))
      .finally(() => setCargandoConceptos(false));
  }, [idConsulta]);

  const subtotalEstimado = useMemo(() => {
    if (origen === 'atencion') {
      return conceptos.reduce((suma, c) => suma + Number(c.cantidad) * Number(c.precio_unitario), 0);
    }
    return lineas.reduce((suma, l) => suma + (Number(l.cantidad) || 0) * (Number(l.precio) || 0), 0);
  }, [origen, conceptos, lineas]);

  const porcentaje = Number(impuesto) || 0;
  const impuestoEstimado = Math.round(((subtotalEstimado * porcentaje) / 100) * 100) / 100;

  function actualizarLinea(indice: number, campo: keyof LineaServicio, valor: string) {
    setLineas((actuales) => actuales.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (Number(impuesto) < 0 || Number.isNaN(Number(impuesto))) {
      nuevosErrores.impuesto = 'Debe ser un número mayor o igual a 0.';
    }

    if (origen === 'atencion') {
      if (!idConsulta) nuevosErrores.atencion = 'Selecciona la atención a facturar.';
      else if (conceptos.length === 0 && !cargandoConceptos) {
        nuevosErrores.atencion = 'Esa atención no registró productos, así que no hay nada que cobrar por ella.';
      }
    } else {
      if (!propietario) nuevosErrores.propietario = 'Indica a nombre de quién se emite la factura.';
      const validas = lineas.filter((l) => l.descripcion.trim());
      if (validas.length === 0) nuevosErrores.lineas = 'Agrega al menos un concepto con descripción.';
      else if (validas.some((l) => !(Number(l.cantidad) > 0) || !(Number(l.precio) >= 0))) {
        nuevosErrores.lineas = 'Cada concepto necesita una cantidad mayor a 0 y un precio válido.';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function emitir() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      const idFactura = await emitirFactura(
        origen === 'atencion'
          ? {
              idPropietario: null,
              idConsulta: idConsulta as number,
              porcentajeImpuesto: porcentaje,
              // null: los conceptos y sus precios los recupera el servidor de la
              // atencion (RF-028/RN-014). No se reenvian los que se ven en pantalla.
              lineas: null,
            }
          : {
              idPropietario: propietario!.id_propietario,
              idConsulta: null,
              porcentajeImpuesto: porcentaje,
              lineas: lineas
                .filter((l) => l.descripcion.trim())
                .map((l) => ({
                  id_producto: null,
                  descripcion: l.descripcion.trim(),
                  cantidad: Number(l.cantidad),
                  precio_unitario: Number(l.precio),
                })),
            },
      );
      onEmitida(idFactura);
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  const atencionSeleccionada = atenciones.find((a) => a.id_consulta === idConsulta) ?? null;

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Emitir factura</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <ToggleButtonGroup
            exclusive
            size="small"
            value={origen}
            onChange={(_e, valor: Origen | null) => valor && setOrigen(valor)}
          >
            <ToggleButton value="atencion">Cobrar una atención</ToggleButton>
            <ToggleButton value="servicios">Cobrar servicios</ToggleButton>
          </ToggleButtonGroup>

          {origen === 'atencion' ? (
            <>
              <TextField
                select
                label="Atención a facturar"
                required
                fullWidth
                value={idConsulta}
                error={!!errores.atencion}
                helperText={
                  errores.atencion ||
                  (atenciones.length === 0 ? 'No hay atenciones pendientes de facturar.' : '')
                }
                onChange={(e) => setIdConsulta(e.target.value ? Number(e.target.value) : '')}
              >
                {atenciones.map((a) => (
                  <MenuItem key={a.id_consulta} value={a.id_consulta}>
                    {dayjs(a.fecha_hora).format('DD/MM/YYYY HH:mm')} · {a.paciente} · {a.propietario_nombres}{' '}
                    {a.propietario_apellidos}
                  </MenuItem>
                ))}
              </TextField>

              {atencionSeleccionada && (
                <Typography variant="body2" color="text.secondary">
                  {/* RN-012: el titular del cobro es el propietario, no el paciente. */}
                  Se facturará a nombre de {atencionSeleccionada.propietario_nombres}{' '}
                  {atencionSeleccionada.propietario_apellidos} ({atencionSeleccionada.propietario_identificacion}).
                </Typography>
              )}

              {conceptos.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Conceptos recuperados de la atención
                  </Typography>
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
                      {conceptos.map((c) => (
                        <TableRow key={`${c.id_producto}-${c.descripcion}`}>
                          <TableCell>{c.descripcion}</TableCell>
                          <TableCell align="right">{c.cantidad}</TableCell>
                          <TableCell align="right">{formatoMoneda(c.precio_unitario)}</TableCell>
                          <TableCell align="right">
                            {formatoMoneda(Number(c.cantidad) * Number(c.precio_unitario))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          ) : (
            <Box>
              <Box sx={{ mb: 2 }}>
                <PropietarioAutocomplete
                  value={propietario}
                  onChange={setPropietario}
                  error={errores.propietario}
                  textoSinOpciones="Sin coincidencias. El propietario debe estar registrado antes de facturarle."
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {/* No existe catalogo de servicios en el diseno de BD aprobado: un
                    servicio se cobra como linea de texto con su precio. */}
                Los servicios se escriben con su precio; los productos de inventario se cobran desde la atención.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Concepto</TableCell>
                    <TableCell sx={{ width: 110 }}>Cantidad</TableCell>
                    <TableCell sx={{ width: 130 }}>Precio</TableCell>
                    <TableCell sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineas.map((linea, indice) => (
                    <TableRow key={indice}>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Consulta general, baño…"
                          value={linea.descripcion}
                          slotProps={{ htmlInput: { maxLength: 120 } }}
                          onChange={(e) => actualizarLinea(indice, 'descripcion', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={linea.cantidad}
                          slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                          onChange={(e) => actualizarLinea(indice, 'cantidad', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={linea.precio}
                          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                          onChange={(e) => actualizarLinea(indice, 'precio', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          disabled={lineas.length === 1}
                          onClick={() => setLineas((actuales) => actuales.filter((_l, i) => i !== indice))}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ mt: 1 }}
                onClick={() => setLineas((actuales) => [...actuales, { ...LINEA_VACIA }])}
              >
                Agregar concepto
              </Button>
              {errores.lineas && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                  {errores.lineas}
                </Typography>
              )}
            </Box>
          )}

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Impuesto (%)"
              type="number"
              value={impuesto}
              error={!!errores.impuesto}
              helperText={errores.impuesto}
              sx={{ width: 160 }}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              onChange={(e) => setImpuesto(e.target.value)}
            />
            <Box sx={{ ml: { sm: 'auto' }, textAlign: { sm: 'right' } }}>
              {/* Estimacion para que Recepcion vea el importe antes de emitir. Los
                  valores definitivos los calcula la base (subtotal por trigger,
                  total como columna generada). */}
              <Typography variant="body2" color="text.secondary">
                Subtotal: {formatoMoneda(subtotalEstimado)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Impuesto: {formatoMoneda(impuestoEstimado)}
              </Typography>
              <Typography variant="h6">Total: {formatoMoneda(subtotalEstimado + impuestoEstimado)}</Typography>
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={emitir} loading={guardando}>
          Emitir factura
        </Button>
      </DialogActions>
    </Dialog>
  );
}
