import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { Propietario } from '../../types/dominio';
import { reenviarAccesoPortal } from './api';

interface Props {
  propietario: Propietario | null;
  onCerrar: () => void;
  onReenviado: () => void;
}

// Recuperación para un propietario que YA tiene cuenta de portal (a diferencia de
// AccesoPortalDialog, que es para quien todavía no tiene una): genera una
// contraseña nueva al azar y la reenvía por correo -- necesario sobre todo para el
// caso "la cuenta se creó automáticamente al registrar un paciente, pero el envío
// del correo falló" (ver CLAUDE.md sección 14, ampliación posterior a la Fase 5).
// Sin campos: la contraseña nunca se escribe a mano ni se muestra en el cliente.
export function ReenviarAccesoPortalDialog({ propietario, onCerrar, onReenviado }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<'ok' | 'fallo_correo' | null>(null);

  useEffect(() => {
    setErrorGeneral(null);
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietario?.id_propietario]);

  if (!propietario) return null;

  async function reenviar() {
    setErrorGeneral(null);
    setEnviando(true);
    try {
      const respuesta = await reenviarAccesoPortal(propietario!.id_propietario);
      setResultado(respuesta.envioCorreoFallido ? 'fallo_correo' : 'ok');
      onReenviado();
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={!!propietario} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Reenviar acceso al portal</DialogTitle>
      <DialogContent dividers>
        {errorGeneral && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorGeneral}
          </Alert>
        )}
        {resultado === 'ok' && (
          <Alert severity="success">
            Se generó una nueva contraseña y se envió por correo a {propietario.correo}.
          </Alert>
        )}
        {resultado === 'fallo_correo' && (
          <Alert severity="warning">
            Se generó una nueva contraseña, pero no se pudo enviar el correo. Intenta reenviar de nuevo en unos
            minutos.
          </Alert>
        )}
        {!resultado && (
          <Typography variant="body2" color="text.secondary">
            Se generará una contraseña temporal nueva para {propietario.nombres} {propietario.apellidos} y se
            enviará a {propietario.correo ?? 'su correo registrado'}. La contraseña anterior deja de funcionar.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
        {!resultado && (
          <Button variant="contained" onClick={reenviar} loading={enviando}>
            Reenviar acceso
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
