import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import LogoutIcon from '@mui/icons-material/Logout';
import { usePortalAuth } from './PortalAuthContext';

const NAV = [
  { ruta: '/portal/mascotas', etiqueta: 'Mis mascotas' },
  { ruta: '/portal/citas', etiqueta: 'Mis citas' },
  { ruta: '/portal/facturas', etiqueta: 'Mis facturas' },
];

// Layout propio del portal, deliberadamente mas simple que AppLayout (personal):
// solo tres secciones, sin Drawer -- no hace falta reproducir esa maquinaria para
// un menu de tres enlaces.
export function PortalLayout() {
  const { sesion, cerrarSesion } = usePortalAuth();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (!sesion) return null;

  const nombreCompleto = `${sesion.propietario.nombres} ${sesion.propietario.apellidos}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <PetsIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: 20, mr: 3 }}>
            VetCare
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
            {NAV.map((item) => (
              <Button
                key={item.ruta}
                component={RouterLink}
                to={item.ruta}
                color={location.pathname.startsWith(item.ruta) ? 'primary' : 'inherit'}
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

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
