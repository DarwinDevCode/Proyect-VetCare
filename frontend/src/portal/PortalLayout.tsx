import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import EventIcon from '@mui/icons-material/Event';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LogoutIcon from '@mui/icons-material/Logout';
import { usePortalAuth } from './PortalAuthContext';

const NAV = [
  { ruta: '/portal/mascotas', etiqueta: 'Mis mascotas', Icono: PetsIcon },
  { ruta: '/portal/citas', etiqueta: 'Mis citas', Icono: EventIcon },
  { ruta: '/portal/facturas', etiqueta: 'Mis facturas', Icono: ReceiptLongIcon },
];

// Layout propio del portal, deliberadamente mas simple que AppLayout (personal):
// solo tres secciones. En escritorio siguen como enlaces en el AppBar; en
// movil (RF-043/044/045 se usan tanto o mas desde el celular del propietario
// que desde una compu) se agrega una barra de navegacion fija abajo, con
// iconos alcanzables con el pulgar -- reemplaza los enlaces de texto, que en
// una pantalla angosta no entraban en una sola fila del Toolbar.
export function PortalLayout() {
  const { sesion, cerrarSesion } = usePortalAuth();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (!sesion) return null;

  const nombreCompleto = `${sesion.propietario.nombres} ${sesion.propietario.apellidos}`;
  const seccionActiva = NAV.find((item) => location.pathname.startsWith(item.ruta))?.ruta ?? false;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <PetsIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: 20, mr: { xs: 1, sm: 3 } }}>
            VetCare
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
            {NAV.map((item) => (
              <Button
                key={item.ruta}
                component={RouterLink}
                to={item.ruta}
                color={location.pathname.startsWith(item.ruta) ? 'primary' : 'inherit'}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                {item.etiqueta}
              </Button>
            ))}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
            {nombreCompleto}
          </Typography>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32 }}>{sesion.propietario.nombres[0]}</Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{nombreCompleto}</MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                cerrarSesion();
              }}
            >
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3, px: { xs: 2, sm: 3 }, pb: { xs: 9, sm: 3 } }}>
        <Outlet />
      </Container>

      <Paper
        elevation={3}
        sx={{ display: { xs: 'block', sm: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar }}
      >
        <BottomNavigation value={seccionActiva} showLabels sx={{ height: 64 }}>
          {NAV.map((item) => (
            <BottomNavigationAction
              key={item.ruta}
              component={RouterLink}
              to={item.ruta}
              value={item.ruta}
              label={item.etiqueta}
              icon={<item.Icono />}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
