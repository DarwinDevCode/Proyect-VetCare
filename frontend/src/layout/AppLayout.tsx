import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Typography,
  Chip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PetsIcon from '@mui/icons-material/Pets';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuth } from '../auth/AuthContext';
import { modulosParaRol } from './modulos';
import { ORGANIC } from '../theme';

const ANCHO_DRAWER = 260;

const ETIQUETA_ROL: Record<string, string> = {
  recepcionista: 'Recepcionista',
  veterinario: 'Veterinario',
  administrador: 'Administrador',
};

export function AppLayout() {
  const { sesion, cerrarSesion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [busqueda, setBusqueda] = useState('');

  if (!sesion) return null;

  const modulos = modulosParaRol(sesion.rol.codigo);
  const nombreCompleto = `${sesion.usuario.nombres} ${sesion.usuario.apellidos}`;

  // Atajo de navegacion, no un buscador propio: reutiliza el buscador que ya
  // existe en Pacientes (RF-007) en vez de duplicar logica de busqueda aqui.
  function buscarDesdeTopbar() {
    const texto = busqueda.trim();
    if (!texto) return;
    navigate(`/pacientes?q=${encodeURIComponent(texto)}`);
  }

  const contenidoDrawer = (
    <Box role="presentation" sx={{ height: '100%', bgcolor: ORGANIC.surface }}>
      <Toolbar sx={{ gap: 1 }}>
        <PetsIcon color="primary" />
        <Typography variant="h6" sx={{ fontSize: 20 }}>
          VetCare
        </Typography>
      </Toolbar>
      <List sx={{ px: 1.5 }}>
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
              sx={{
                borderRadius: 999,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: ORGANIC.accent[100],
                  color: ORGANIC.accent[800],
                  '& .MuiListItemIcon-root': { color: ORGANIC.accent[700] },
                  '&:hover': { bgcolor: ORGANIC.accent[200] },
                },
              }}
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
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            edge="start"
            sx={{ display: { sm: 'none' } }}
            onClick={() => setDrawerAbierto(true)}
          >
            <MenuIcon />
          </IconButton>
          <TextField
            placeholder="Buscar mascota, dueño…"
            size="small"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') buscarDesdeTopbar();
            }}
            sx={{ display: { xs: 'none', sm: 'block' }, width: 260 }}
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
          <Box sx={{ flexGrow: 1 }} />
          <IconButton>
            <NotificationsIcon />
          </IconButton>
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
          '& .MuiDrawer-paper': { width: ANCHO_DRAWER, boxSizing: 'border-box', borderRight: 'none' },
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
