import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { registrarMovimiento } from '../inventario/api';
import { listarProductosConsumibles, type ProductoConsumible } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  // RN-009: todo consumo debe estar justificado por una atencion registrada, asi que
  // este dialogo solo se abre desde una consulta -- nunca de forma independiente,
  // a diferencia de vacunacion y examen.
  idConsulta: number | null;
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

// RF-023: registrar los productos utilizados en una atencion y descontarlos de las
// existencias. Es el unico punto de la aplicacion donde un Veterinario escribe en
// movimiento_inventario a mano (RF-024, el descuento por vacuna, lo hace un trigger).
export function RegistrarConsumoDialog({ idConsulta, abierto, onCerrar, onCreado }: Props) {
  const [productos, setProductos] = useState<ProductoConsumible[]>([]);
  const [idProducto, setIdProducto] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState('');
  const [observacion, setObservacion] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Se recarga el catalogo en CADA apertura, no solo cuando cambia algun valor del
  // formulario: la existencia mostrada tiene que reflejar los consumos hechos desde
  // el dialogo anterior (mismo problema que se corrigio en useDisponibilidadCita).
  useEffect(() => {
    if (!abierto) return;
    setIdProducto('');
    setCantidad('');
    setObservacion('');
    setErrores({});
    setErrorGeneral(null);
    listarProductosConsumibles()
      .then(setProductos)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto]);

  const seleccionado = productos.find((p) => p.id_producto === idProducto) ?? null;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!idProducto) nuevosErrores.producto = 'Selecciona un producto.';
    const cantidadNum = Number(cantidad);
    if (cantidad.trim() === '' || Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      nuevosErrores.cantidad = 'Debe ser un número mayor a 0.';
    } else if (seleccionado && cantidadNum > seleccionado.existencia_actual) {
      // Retroalimentacion inmediata; la garantia real sigue siendo el trigger
      // fn_actualizar_existencia, que rechaza cualquier existencia negativa (RN-010).
      nuevosErrores.cantidad = `Solo hay ${seleccionado.existencia_actual} ${seleccionado.unidad_medida} disponibles.`;
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (idConsulta === null || !validar()) return;

    setGuardando(true);
    try {
      // El usuario nunca escribe un signo: se pide una cantidad positiva y se
      // convierte a negativa aqui, porque chk_movimiento_signo exige cantidad < 0
      // para un consumo (mismo criterio que el formulario de ajuste del Modulo 4).
      await registrarMovimiento({
        id_producto: idProducto as number,
        tipo_movimiento: 'consumo',
        cantidad: -Number(cantidad),
        id_consulta: idConsulta,
        observacion: observacion.trim() || null,
      });
      onCreado();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar consumo de producto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Typography variant="body2" color="text.secondary">
            El producto se descontará de las existencias y quedará registrado como consumo de esta consulta.
          </Typography>

          <TextField
            select
            label="Producto"
            required
            fullWidth
            value={idProducto}
            error={!!errores.producto}
            helperText={
              errores.producto ||
              (productos.length === 0
                ? 'No hay medicamentos ni insumos activos en el catálogo.'
                : 'Las vacunas se registran como vacunación: su dosis se descuenta automáticamente.')
            }
            onChange={(e) => setIdProducto(e.target.value ? Number(e.target.value) : '')}
          >
            {productos.map((p) => (
              <MenuItem key={p.id_producto} value={p.id_producto}>
                {p.nombre} — {p.existencia_actual} {p.unidad_medida} disponibles
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Cantidad utilizada"
            type="number"
            required
            fullWidth
            value={cantidad}
            error={!!errores.cantidad}
            helperText={errores.cantidad || (seleccionado ? `Unidad: ${seleccionado.unidad_medida}` : '')}
            slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            onChange={(e) => setCantidad(e.target.value)}
          />

          <TextField
            label="Observación (opcional)"
            fullWidth
            multiline
            minRows={2}
            value={observacion}
            slotProps={{ htmlInput: { maxLength: 150 } }}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar consumo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
