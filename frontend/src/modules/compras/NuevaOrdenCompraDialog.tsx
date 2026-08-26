import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import type { Producto, Proveedor } from '../../types/dominio';
import { listarProductos } from '../inventario/api';
import { crearOrdenCompra } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  proveedores: Proveedor[];
  onCerrar: () => void;
  onCreada: () => void;
}

interface Linea {
  idProducto: number | '';
  cantidad: string;
  precioUnitario: string;
}

const LINEA_VACIA: Linea = { idProducto: '', cantidad: '1', precioUnitario: '' };

// RF-037: crear una orden de compra (proveedor + líneas) en una sola operación
// atómica -- mismo patrón que la vía "Cobrar servicios" de NuevaFacturaDialog. La
// orden nace en 'borrador'; emitirla/recibirla son transiciones aparte (RF-038/039).
export function NuevaOrdenCompraDialog({ abierto, proveedores, onCerrar, onCreada }: Props) {
  const [idProveedor, setIdProveedor] = useState<number | ''>('');
  const [observacion, setObservacion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ ...LINEA_VACIA }]);
  const [productos, setProductos] = useState<Producto[]>([]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setIdProveedor('');
    setObservacion('');
    setLineas([{ ...LINEA_VACIA }]);
    setErrores({});
    setErrorGeneral(null);
    listarProductos()
      .then(setProductos)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto]);

  const total = useMemo(
    () => lineas.reduce((suma, l) => suma + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0),
    [lineas],
  );

  function actualizarLinea(indice: number, cambios: Partial<Linea>) {
    setLineas((actuales) => actuales.map((l, i) => (i === indice ? { ...l, ...cambios } : l)));
  }

  // Al elegir el producto se sugiere su precio actual del catálogo -- editable
  // despues, igual que el precio de un servicio en NuevaFacturaDialog.
  function elegirProducto(indice: number, idProducto: number) {
    const producto = productos.find((p) => p.id_producto === idProducto);
    actualizarLinea(indice, {
      idProducto,
      precioUnitario: producto ? String(producto.precio_unitario) : '',
    });
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!idProveedor) nuevosErrores.proveedor = 'Selecciona un proveedor.';

    const validas = lineas.filter((l) => l.idProducto);
    if (validas.length === 0) {
      nuevosErrores.lineas = 'Agrega al menos un producto.';
    } else if (validas.some((l) => !(Number(l.cantidad) > 0) || !(Number(l.precioUnitario) >= 0))) {
      nuevosErrores.lineas = 'Cada línea necesita una cantidad mayor a 0 y un precio válido.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearOrdenCompra(
        idProveedor as number,
        observacion.trim() || null,
        lineas
          .filter((l) => l.idProducto)
          .map((l) => ({
            id_producto: l.idProducto as number,
            cantidad: Number(l.cantidad),
            precio_unitario: Number(l.precioUnitario),
          })),
      );
      onCreada();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Nueva orden de compra</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <TextField
            select
            label="Proveedor"
            required
            fullWidth
            value={idProveedor}
            error={!!errores.proveedor}
            helperText={errores.proveedor || (proveedores.length === 0 ? 'No hay proveedores activos.' : '')}
            onChange={(e) => setIdProveedor(e.target.value ? Number(e.target.value) : '')}
          >
            {proveedores.map((p) => (
              <MenuItem key={p.id_proveedor} value={p.id_proveedor}>
                {p.nombre}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell sx={{ width: 110 }}>Cantidad</TableCell>
                  <TableCell sx={{ width: 130 }}>Precio unitario</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {lineas.map((linea, indice) => (
                  <TableRow key={indice}>
                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={linea.idProducto}
                        onChange={(e) => elegirProducto(indice, Number(e.target.value))}
                      >
                        {productos.map((p) => (
                          <MenuItem key={p.id_producto} value={p.id_producto}>
                            {p.nombre}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={linea.cantidad}
                        slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                        onChange={(e) => actualizarLinea(indice, { cantidad: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={linea.precioUnitario}
                        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                        onChange={(e) => actualizarLinea(indice, { precioUnitario: e.target.value })}
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
              Agregar producto
            </Button>
            {errores.lineas && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                {errores.lineas}
              </Typography>
            )}
          </Box>

          <TextField
            label="Observación (opcional)"
            fullWidth
            multiline
            minRows={2}
            value={observacion}
            slotProps={{ htmlInput: { maxLength: 150 } }}
            onChange={(e) => setObservacion(e.target.value)}
          />

          <Typography variant="h6" sx={{ textAlign: 'right' }}>
            Total estimado: ${total.toFixed(2)}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar orden
        </Button>
      </DialogActions>
    </Dialog>
  );
}
