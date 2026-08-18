import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Chip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PetsIcon from '@mui/icons-material/Pets';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext';
import { modulosParaRol } from './modulos';

const ANCHO_DRAWER = 260;

const ETIQUETA_ROL: Record<string, string> = {
  recepcionista: 'Recepcionista',
  veterinario: 'Veterinario',
  administrador: 'Administrador',
};

export function AppLayout() {
  const { sesion, cerrarSesion } = useAuth();
  const location = useLocation();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (!sesion) return null;

  const modulos = modulosParaRol(sesion.rol.codigo);
  const nombreCompleto = `${sesion.usuario.nombres} ${sesion.usuario.apellidos}`;

  const contenidoDrawer = (
    <Box role="presentation">
      <Toolbar sx={{ gap: 1 }}>
        <PetsIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          VetCare
        </Typography>
      </Toolbar>
      <List>
        {modulos.map((modulo) => {
          const Icono = modulo.icono;
          const activo = location.pathname.startsWith(modulo.ruta);
          return (
            <ListItemButton
              key={modulo.ruta}
              component={RouterLink}
              to={modulo.ruta}
              selected={activo}
              onClick={() => setDrawerAbierto(false)}
            >
              <ListItemIcon>
                <Icono />
              </ListItemIcon>
              <ListItemText primary={modulo.etiqueta} />
              {!modulo.implementado && <Chip label="pronto" size="small" variant="outlined" />}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            sx={{ display: { sm: 'none' } }}
            onClick={() => setDrawerAbierto(true)}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Chip label={ETIQUETA_ROL[sesion.rol.codigo] ?? sesion.rol.nombre} size="small" color="primary" variant="outlined" />
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {sesion.usuario.nombres.charAt(0)}
              {sesion.usuario.apellidos.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{nombreCompleto}</MenuItem>
            <MenuItem onClick={cerrarSesion}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: ANCHO_DRAWER } }}
      >
        {contenidoDrawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: ANCHO_DRAWER,
          '& .MuiDrawer-paper': { width: ANCHO_DRAWER, boxSizing: 'border-box' },
        }}
        open
      >
        {contenidoDrawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: { sm: `calc(100% - ${ANCHO_DRAWER}px)` } }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
