import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
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
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import type { LotePorVencer, Producto } from '../../types/dominio';
import { listarLotesPorVencer, listarProductos } from './api';
import { mensajeError } from '../../lib/errors';
import { NuevoProductoDialog } from './NuevoProductoDialog';
import { ProductoDetalleDialog } from './ProductoDetalleDialog';
import { useAuth } from '../../auth/AuthContext';

const ETIQUETA_TIPO: Record<Producto['tipo'], string> = {
  medicamento: 'Medicamento',
  insumo: 'Insumo',
  vacuna: 'Vacuna',
};

type FiltroTipo = 'todos' | Producto['tipo'];
const OPCIONES_FILTRO_TIPO: FiltroTipo[] = ['todos', 'medicamento', 'vacuna', 'insumo'];
const ETIQUETA_FILTRO_TIPO: Record<FiltroTipo, string> = {
  todos: 'Todos',
  ...ETIQUETA_TIPO,
};

export function InventarioPage() {
  const { sesion } = useAuth();
  const puedeGestionar = sesion?.rol.codigo === 'administrador';
  const navegar = useNavigate();

  const [texto, setTexto] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotesPorVencer, setLotesPorVencer] = useState<LotePorVencer[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevoAbierto, setDialogoNuevoAbierto] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [soloPorVencer, setSoloPorVencer] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resultado, lotes] = await Promise.all([listarProductos(), listarLotesPorVencer()]);
      setProductos(resultado);
      setLotesPorVencer(lotes);
      // Si el detalle de un producto esta abierto, se refresca con los datos nuevos
      // (mismo patron que PacientesPage tras editar una ficha).
      setProductoSeleccionado((actual) =>
        actual ? resultado.find((p) => p.id_producto === actual.id_producto) ?? null : null,
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

  // RF-025: catalogo acotado, sin ilike contra el servidor -- se filtra en memoria.
  // El filtro por tipo y "bajo minimo" (1n) son la misma idea: acotar en memoria lo
  // que ya esta cargado, no una consulta nueva.
  // Fase 2: productos con al menos un lote por vencer (v_lotes_por_vencer, distinto
  // de v_alerta_stock -- este es su propio origen de datos, no se deriva de
  // "productos" como el resto de filtros de esta pagina).
  const idsProductosPorVencer = useMemo(
    () => new Set(lotesPorVencer.map((l) => l.id_producto)),
    [lotesPorVencer],
  );

  const productosFiltrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return productos.filter((p) => {
      if (t && !p.nombre.toLowerCase().includes(t) && !p.codigo.toLowerCase().includes(t)) return false;
      if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false;
      if (soloAlertas && !(p.activo && p.existencia_actual <= p.nivel_minimo)) return false;
      if (soloPorVencer && !idsProductosPorVencer.has(p.id_producto)) return false;
      return true;
    });
  }, [productos, texto, filtroTipo, soloAlertas, soloPorVencer, idsProductosPorVencer]);

  // RF-026: se deriva del mismo array ya cargado, no de una consulta aparte a
  // v_alerta_stock (evita una segunda fuente de datos que podria desincronizarse).
  const alertas = useMemo(
    () => productos.filter((p) => p.activo && p.existencia_actual <= p.nivel_minimo),
    [productos],
  );

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Inventario y Medicamentos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta el catálogo y las existencias de medicamentos, insumos y vacunas.
          </Typography>
        </Box>
        {puedeGestionar && (
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ShoppingCartIcon />} onClick={() => navegar('/compras')}>
              Generar orden de compra
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogoNuevoAbierto(true)}
            >
              Nuevo producto
            </Button>
          </Stack>
        )}
      </Stack>

      <TextField
        fullWidth
        placeholder="Buscar por nombre o código…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        sx={{ mb: 2, maxWidth: 520 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {OPCIONES_FILTRO_TIPO.map((opcion) => (
          <Chip
            key={opcion}
            label={ETIQUETA_FILTRO_TIPO[opcion]}
            size="small"
            color={filtroTipo === opcion ? 'primary' : 'default'}
            variant={filtroTipo === opcion ? 'filled' : 'outlined'}
            onClick={() => setFiltroTipo(opcion)}
          />
        ))}
        <Chip
          label="Bajo mínimo"
          size="small"
          color={soloAlertas ? 'warning' : 'default'}
          variant={soloAlertas ? 'filled' : 'outlined'}
          onClick={() => setSoloAlertas((a) => !a)}
        />
        <Chip
          label="Por vencer"
          size="small"
          color={soloPorVencer ? 'warning' : 'default'}
          variant={soloPorVencer ? 'filled' : 'outlined'}
          onClick={() => setSoloPorVencer((a) => !a)}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {alertas.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {alertas.length} producto{alertas.length === 1 ? '' : 's'} con existencia en o por
          debajo del nivel mínimo.
        </Alert>
      )}

      {lotesPorVencer.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {lotesPorVencer.length} lote{lotesPorVencer.length === 1 ? '' : 's'} por vencer en los
          próximos 30 días.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Existencia</TableCell>
              <TableCell>Nivel mínimo</TableCell>
              <TableCell>Precio</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && productosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <Inventory2Icon fontSize="large" />
                    <Typography variant="body2">
                      {texto || filtroTipo !== 'todos' || soloAlertas || soloPorVencer
                        ? 'Sin resultados para esa búsqueda.'
                        : 'Todavía no hay productos registrados.'}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {productosFiltrados.map((producto) => {
              const alerta = producto.activo && producto.existencia_actual <= producto.nivel_minimo;
              return (
                <TableRow
                  key={producto.id_producto}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setProductoSeleccionado(producto)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {producto.nombre}
                    </Typography>
                  </TableCell>
                  <TableCell>{producto.codigo}</TableCell>
                  <TableCell>
                    <Chip label={ETIQUETA_TIPO[producto.tipo]} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Typography
                        variant="body2"
                        color={alerta ? 'warning.main' : 'text.primary'}
                        sx={{ fontWeight: alerta ? 600 : 400 }}
                      >
                        {producto.existencia_actual}
                      </Typography>
                      {alerta && <Chip label="Bajo mínimo" size="small" color="warning" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{producto.nivel_minimo}</TableCell>
                  <TableCell>${producto.precio_unitario.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip
                      label={producto.activo ? 'Activo' : 'Inactivo'}
                      size="small"
                      variant={producto.activo ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <NuevoProductoDialog
        abierto={dialogoNuevoAbierto}
        onCerrar={() => setDialogoNuevoAbierto(false)}
        onCreado={recargar}
      />

      <ProductoDetalleDialog
        producto={productoSeleccionado}
        puedeGestionar={puedeGestionar}
        onCerrar={() => setProductoSeleccionado(null)}
        onActualizado={recargar}
      />
    </Box>
  );
}
