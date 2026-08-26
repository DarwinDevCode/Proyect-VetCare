import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Propietario } from '../../types/dominio';
import { emitirAccesoPortal } from './api';

interface Props {
  propietario: Propietario | null;
  onCerrar: () => void;
  onEmitido: () => void;
}

// RF-042: emitir acceso al portal desde la ficha del propietario -- no hay
// autoregistro publico (CLAUDE.md sección 1, "el propietario no es usuario del
// sistema" se amplia deliberadamente aqui, ver seccion 14). Recepcion elige el
// correo y una contraseña inicial; el propietario puede cambiarla despues desde
// el propio portal (fuera de esta pasada -- ver Pendiente en CLAUDE.md).
export function AccesoPortalDialog({ propietario, onCerrar, onEmitido }: Props) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [emitido, setEmitido] = useState<string | null>(null);

  useEffect(() => {
    if (!propietario) return;
    setCorreo(propietario.correo ?? '');
    setPassword('');
    setErrores({});
    setErrorGeneral(null);
    setEmitido(null);
    // Dependencia por id, no por el objeto "propietario" completo: onEmitido()
    // dispara un recargar() en el padre que reemplaza ese objeto por uno nuevo
    // (misma fila, distinta referencia) mientras este dialogo sigue abierto
    // mostrando el mensaje de exito -- si el efecto dependiera del objeto,
    // ese recargar volveria a dispararlo y borraria el mensaje de exito recien
    // mostrado. Bug real encontrado probando el flujo completo en el navegador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietario?.id_propietario]);

  if (!propietario) return null;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!correo.trim() || !correo.includes('@')) nuevosErrores.correo = 'Ingresa un correo válido.';
    if (password.length < 8) nuevosErrores.password = 'Debe tener al menos 8 caracteres.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function emitir() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await emitirAccesoPortal(propietario!.id_propietario, correo.trim(), password);
      setEmitido(correo.trim());
      onEmitido();
    } catch (error) {
      // emitirAccesoPortal ya lanza un Error con el mensaje en espanol que
      // redacta la Edge Function (mismo patron que invocarAdminUsuarios) -- no
      // es un PostgrestError, asi que no pasa por mensajeError().
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={!!propietario} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Dar acceso al portal</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          {emitido ? (
            <Alert severity="success">
              Acceso creado para {propietario.nombres} {propietario.apellidos} con el correo {emitido}. Comparte la
              contraseña con el propietario por un medio seguro.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {propietario.nombres} {propietario.apellidos} podrá ingresar al portal con este correo y
                contraseña para ver a sus mascotas, citas y facturas.
              </Typography>
              <TextField
                label="Correo"
                type="email"
                required
                fullWidth
                value={correo}
                error={!!errores.correo}
                helperText={errores.correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              <TextField
                label="Contraseña inicial"
                type="text"
                required
                fullWidth
                value={password}
                error={!!errores.password}
                helperText={errores.password || 'Mínimo 8 caracteres. Compártela con el propietario aparte.'}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{emitido ? 'Cerrar' : 'Cancelar'}</Button>
        {!emitido && (
          <Button variant="contained" onClick={emitir} loading={guardando}>
            Crear acceso
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
