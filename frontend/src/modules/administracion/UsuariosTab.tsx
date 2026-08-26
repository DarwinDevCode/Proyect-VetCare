import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import dayjs from 'dayjs';
import type { UsuarioConRol } from '../../types/dominio';
import { activarUsuario, desactivarUsuario, listarUsuarios } from './api';
import { mensajeError } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { NuevoUsuarioDialog } from './NuevoUsuarioDialog';
import { EditarUsuarioDialog } from './EditarUsuarioDialog';
import { RestablecerContrasenaDialog } from './RestablecerContrasenaDialog';

const ETIQUETA_ROL: Record<string, string> = {
  recepcionista: 'Recepcionista',
  veterinario: 'Veterinario',
  administrador: 'Administrador',
};

export function UsuariosTab() {
  const { sesion } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const [dialogoNuevoAbierto, setDialogoNuevoAbierto] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<UsuarioConRol | null>(null);
  const [usuarioParaRestablecer, setUsuarioParaRestablecer] = useState<UsuarioConRol | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<{ anchor: HTMLElement; usuario: UsuarioConRol } | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await listarUsuarios());
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return usuarios;
    return usuarios.filter(
      (u) =>
        `${u.nombres} ${u.apellidos}`.toLowerCase().includes(texto) ||
        u.correo.toLowerCase().includes(texto),
    );
  }, [usuarios, busqueda]);

  async function alternarActivo(usuario: UsuarioConRol) {
    setMenuAbierto(null);
    setAccionEnCurso(usuario.id_usuario);
    setError(null);
    try {
      if (usuario.activo) await desactivarUsuario(usuario.id_usuario);
      else await activarUsuario(usuario.id_usuario);
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setAccionEnCurso(null);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', mb: 2 }}>
        <TextField
          placeholder="Buscar por nombre o correo…"
          size="small"
          value={busqueda}
          sx={{ minWidth: 280 }}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogoNuevoAbierto(true)}>
          Nuevo usuario
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
              <TableCell>Correo</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Registrado</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {!cargando && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <PeopleAltIcon fontSize="large" />
                    <Typography variant="body2">No hay usuarios que coincidan con la búsqueda.</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((usuario) => (
              <TableRow key={usuario.id_usuario} hover>
                <TableCell>
                  {usuario.nombres} {usuario.apellidos}
                  {usuario.id_usuario === sesion?.usuario.id_usuario && (
                    <Chip label="Tú" size="small" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>{usuario.correo}</TableCell>
                <TableCell>{ETIQUETA_ROL[usuario.rol.codigo] ?? usuario.rol.nombre}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={usuario.activo ? 'Activo' : 'Inactivo'}
                    color={usuario.activo ? 'success' : 'default'}
                    variant={usuario.activo ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{dayjs(usuario.fecha_registro).format('DD/MM/YYYY')}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    disabled={accionEnCurso === usuario.id_usuario}
                    onClick={(e) => setMenuAbierto({ anchor: e.currentTarget, usuario })}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={menuAbierto?.anchor}
        open={!!menuAbierto}
        onClose={() => setMenuAbierto(null)}
      >
        <MenuItem
          onClick={() => {
            setUsuarioParaEditar(menuAbierto!.usuario);
            setMenuAbierto(null);
          }}
        >
          Editar datos y rol
        </MenuItem>
        <MenuItem
          onClick={() => {
            setUsuarioParaRestablecer(menuAbierto!.usuario);
            setMenuAbierto(null);
          }}
        >
          Restablecer contraseña
        </MenuItem>
        <MenuItem onClick={() => alternarActivo(menuAbierto!.usuario)}>
          {menuAbierto?.usuario.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
        </MenuItem>
      </Menu>

      <NuevoUsuarioDialog
        abierto={dialogoNuevoAbierto}
        onCerrar={() => setDialogoNuevoAbierto(false)}
        onCreado={recargar}
      />
      <EditarUsuarioDialog
        usuario={usuarioParaEditar}
        onCerrar={() => setUsuarioParaEditar(null)}
        onActualizado={recargar}
      />
      <RestablecerContrasenaDialog usuario={usuarioParaRestablecer} onCerrar={() => setUsuarioParaRestablecer(null)} />
    </Box>
  );
}
