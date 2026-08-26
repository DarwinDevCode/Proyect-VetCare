import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import dayjs from 'dayjs';
import type { ParametroSistema } from '../../types/dominio';
import { actualizarParametro, listarParametros } from './api';
import { mensajeError } from '../../lib/errors';

// AD-15: parametros de negocio configurables. Saca de hardcodeado dos valores
// que ya estaban documentados como pendientes de decidir con el cliente: el
// impuesto por defecto de una factura (formato.ts) y el horario de atencion
// que usa RF-011 para sugerir huecos libres (disponibilidad.ts). El impuesto
// por defecto ya se lee de aqui en NuevaFacturaDialog; el horario queda
// almacenado y editable, listo para conectarse a la agenda en un siguiente
// paso sin volver a tocar el esquema.
export function ParametrosTab() {
  const [parametros, setParametros] = useState<ParametroSistema[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null);
  const [guardadoClave, setGuardadoClave] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarParametros();
      setParametros(lista);
      setValores(Object.fromEntries(lista.map((p) => [p.clave, p.valor])));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  async function guardar(clave: string) {
    setGuardandoClave(clave);
    setGuardadoClave(null);
    setError(null);
    try {
      await actualizarParametro(clave, valores[clave]);
      setGuardadoClave(clave);
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardandoClave(null);
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        {!cargando &&
          parametros.map((parametro) => (
            <Paper key={parametro.clave} variant="outlined" sx={{ p: 2.5 }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {parametro.descripcion ?? parametro.clave}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Actualizado {dayjs(parametro.fecha_actualizacion).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <TextField
                    size="small"
                    value={valores[parametro.clave] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [parametro.clave]: e.target.value }))}
                    sx={{ maxWidth: 160 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    loading={guardandoClave === parametro.clave}
                    disabled={valores[parametro.clave] === parametro.valor}
                    onClick={() => guardar(parametro.clave)}
                  >
                    Guardar
                  </Button>
                  {guardadoClave === parametro.clave && (
                    <Typography variant="caption" color="success.main">
                      Guardado
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
      </Stack>
    </Box>
  );
}
