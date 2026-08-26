import { useCallback, useEffect, useMemo, useState } from 'react';
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
import StoreIcon from '@mui/icons-material/Store';
import type { Proveedor } from '../../types/dominio';
import { listarProveedores } from './api';
import { mensajeError } from '../../lib/errors';
import { NuevoProveedorDialog } from './NuevoProveedorDialog';
import { ProveedorDetalleDialog } from './ProveedorDetalleDialog';

// RF-036: catálogo de proveedores, mismo patrón que InventarioPage (búsqueda en
// memoria sobre un catálogo acotado, sin ilike contra el servidor).
export function ProveedoresTab() {
  const [texto, setTexto] = useState('');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogoNuevoAbierto, setDialogoNuevoAbierto] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarProveedores();
      setProveedores(resultado);
      setProveedorSeleccionado((actual) =>
        actual ? resultado.find((p) => p.id_proveedor === actual.id_proveedor) ?? null : null,
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

  const proveedoresFiltrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return proveedores;
    return proveedores.filter(
      (p) => p.nombre.toLowerCase().includes(t) || p.identificacion.toLowerCase().includes(t),
    );
  }, [proveedores, texto]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', mb: 2 }}>
        <TextField
          placeholder="Buscar por nombre o RUC…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          sx={{ maxWidth: 420, flexGrow: 1 }}
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogoNuevoAbierto(true)}>
          Nuevo proveedor
        </Button>
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
              <TableCell>Nombre</TableCell>
              <TableCell>RUC</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && proveedoresFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <StoreIcon fontSize="large" />
                    <Typography variant="body2">
                      {texto ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay proveedores registrados.'}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {proveedoresFiltrados.map((proveedor) => (
              <TableRow
                key={proveedor.id_proveedor}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setProveedorSeleccionado(proveedor)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {proveedor.nombre}
                  </Typography>
                </TableCell>
                <TableCell>{proveedor.identificacion}</TableCell>
                <TableCell>{proveedor.telefono}</TableCell>
                <TableCell>{proveedor.correo || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={proveedor.activo ? 'Activo' : 'Inactivo'}
                    size="small"
                    variant={proveedor.activo ? 'filled' : 'outlined'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <NuevoProveedorDialog
        abierto={dialogoNuevoAbierto}
        onCerrar={() => setDialogoNuevoAbierto(false)}
        onCreado={recargar}
      />

      <ProveedorDetalleDialog
        proveedor={proveedorSeleccionado}
        onCerrar={() => setProveedorSeleccionado(null)}
        onActualizado={recargar}
      />
    </Box>
  );
}
