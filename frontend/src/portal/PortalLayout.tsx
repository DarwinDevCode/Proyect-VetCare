import { useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Toolbar,
  Typography,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import EventIcon from '@mui/icons-material/Event';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { usePortalAuth } from './PortalAuthContext';
import { CambiarPasswordDialog } from './CambiarPasswordDialog';
import { listarNotificacionesPortal, type NotificacionPortal } from './notificaciones';
import { leerLeidasVigentes, marcarLeidaEnStorage } from '../lib/notificacionesLeidas';
import { ORGANIC } from '../theme';

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
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialogoPasswordAbierto, setDialogoPasswordAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState<NotificacionPortal[]>([]);
  const [leidas, setLeidas] = useState<Set<string>>(new Set());
  const [panelNotificaciones, setPanelNotificaciones] = useState<HTMLElement | null>(null);

  // Mismo criterio que la campana de personal (AppLayout.tsx): la lista se
  // recalcula cada vez que se abre, pero el estado leida/no leida persiste
  // en localStorage (lib/notificacionesLeidas.ts), por propietario.
  useEffect(() => {
    if (!sesion) return;
    listarNotificacionesPortal()
      .then((lista) => {
        setNotificaciones(lista);
        setLeidas(leerLeidasVigentes(String(sesion.propietario.id_propietario), lista.map((n) => n.id)));
      })
      .catch(() => setNotificaciones([]));
  }, [sesion]);

  if (!sesion) return null;

  const nombreCompleto = `${sesion.propietario.nombres} ${sesion.propietario.apellidos}`;
  const seccionActiva = NAV.find((item) => location.pathname.startsWith(item.ruta))?.ruta ?? false;
  const noLeidasCount = notificaciones.filter((n) => !leidas.has(n.id)).length;

  function irANotificacion(n: NotificacionPortal) {
    if (!sesion) return;
    marcarLeidaEnStorage(String(sesion.propietario.id_propietario), n.id);
    setLeidas((actual) => new Set(actual).add(n.id));
    setPanelNotificaciones(null);
    navigate(n.ruta);
  }

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
          <IconButton onClick={(e) => setPanelNotificaciones(e.currentTarget)} aria-label="Notificaciones">
            <Badge badgeContent={noLeidasCount} color="warning">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Popover
            open={!!panelNotificaciones}
            anchorEl={panelNotificaciones}
            onClose={() => setPanelNotificaciones(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { width: 320, maxHeight: 420 } } }}
          >
            <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 1 }}>
              Notificaciones
            </Typography>
            <Divider />
            {notificaciones.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 4, color: 'text.secondary' }}>
                <NotificationsNoneIcon fontSize="large" />
                <Typography variant="body2">No hay notificaciones</Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {notificaciones.map((n) => {
                  const leida = leidas.has(n.id);
                  return (
                    <ListItemButton
                      key={n.id}
                      onClick={() => irANotificacion(n)}
                      sx={{ alignItems: 'flex-start', gap: 1, py: 1, bgcolor: leida ? 'transparent' : ORGANIC.accent[100] }}
                    >
                      <Box
                        sx={{
                          mt: 0.75,
                          width: 8,
                          height: 8,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: leida ? 'transparent' : ORGANIC.accent[600],
                        }}
                      />
                      <ListItemText
                        primary={n.texto}
                        secondary={n.detalle}
                        slotProps={{
                          primary: { sx: { fontWeight: leida ? 400 : 600 } },
                          secondary: { sx: { color: 'text.secondary' } },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Popover>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32 }}>{sesion.propietario.nombres[0]}</Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{nombreCompleto}</MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setDialogoPasswordAbierto(true);
              }}
            >
              <LockResetIcon fontSize="small" sx={{ mr: 1 }} />
              Cambiar contraseña
            </MenuItem>
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

      <CambiarPasswordDialog abierto={dialogoPasswordAbierto} onCerrar={() => setDialogoPasswordAbierto(false)} />

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
