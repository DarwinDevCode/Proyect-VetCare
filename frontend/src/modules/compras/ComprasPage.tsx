import { useEffect, useState } from 'react';
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';
import type { Proveedor } from '../../types/dominio';
import { listarProveedores } from './api';
import { mensajeError } from '../../lib/errors';
import { ProveedoresTab } from './ProveedoresTab';
import { OrdenesCompraTab } from './OrdenesCompraTab';

type Seccion = 'ordenes' | 'proveedores';

// Modulo 7 nuevo (Fase 4, RF-036 a RF-039): Compras y Proveedores, exclusivo de
// Administrador (App.tsx). Dos pestanas, mismo patron que la pestana "Lista de
// espera" dentro de Agenda: no son rutas separadas porque comparten el mismo
// contexto (una orden siempre se emite a un proveedor ya registrado).
export function ComprasPage() {
  const [seccion, setSeccion] = useState<Seccion>('ordenes');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Las ordenes necesitan el catalogo de proveedores para el selector de
  // NuevaOrdenCompraDialog; se carga aqui, una sola vez, y se pasa hacia abajo --
  // ProveedoresTab lo recarga por su cuenta cuando cambia algo en su propia tabla.
  useEffect(() => {
    listarProveedores()
      .then(setProveedores)
      .catch((err) => setError(mensajeError(err)));
  }, [seccion]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Compras y Proveedores
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Registra proveedores y gestiona órdenes de compra hasta su recepción.
        </Typography>
      </Box>

      <Tabs
        value={seccion}
        onChange={(_e, valor: Seccion) => setSeccion(valor)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="ordenes" label="Órdenes de compra" />
        <Tab value="proveedores" label="Proveedores" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {seccion === 'proveedores' ? <ProveedoresTab /> : <OrdenesCompraTab proveedores={proveedores} />}
    </Box>
  );
}
