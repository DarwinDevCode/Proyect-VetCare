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
import type { FormaPago } from '../../types/dominio';
import { registrarPagosMixtos } from './api';
import { mensajeError } from '../../lib/errors';
import { ETIQUETA_FORMA_PAGO, formatoMoneda } from './formato';

interface Props {
  idFactura: number;
  saldoPendiente: number;
  abierto: boolean;
  onCerrar: () => void;
  onRegistrado: () => void;
}

const FORMAS: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia'];

type Lineas = Record<FormaPago, { monto: string; referencia: string }>;

const LINEAS_VACIAS: Lineas = {
  efectivo: { monto: '', referencia: '' },
  tarjeta: { monto: '', referencia: '' },
  transferencia: { monto: '', referencia: '' },
};

// RF-030 / RN-015: una factura puede cobrarse en uno o varios pagos, y (1r) en
// varias formas de pago a la vez -- ej. parte efectivo, parte tarjeta, en una
// sola accion de "Registrar cobro". No se toca la factura al cobrar: su
// situacion de cobro y su saldo los deriva v_estado_factura comparando el total
// con la suma de los pagos.
export function RegistrarPagoDialog({ idFactura, saldoPendiente, abierto, onCerrar, onRegistrado }: Props) {
  const [lineas, setLineas] = useState<Lineas>(LINEAS_VACIAS);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    // Se propone el saldo completo en efectivo, el caso mas habitual en el
    // mostrador; el usuario reparte entre formas si hace falta.
    setLineas({
      ...LINEAS_VACIAS,
      efectivo: { monto: saldoPendiente > 0 ? saldoPendiente.toFixed(2) : '', referencia: '' },
    });
    setErrorGeneral(null);
    setErrorMonto(null);
  }, [abierto, saldoPendiente]);

  function actualizarMonto(forma: FormaPago, monto: string) {
    setLineas((actual) => ({ ...actual, [forma]: { ...actual[forma], monto } }));
  }

  function actualizarReferencia(forma: FormaPago, referencia: string) {
    setLineas((actual) => ({ ...actual, [forma]: { ...actual[forma], referencia } }));
  }

  const totalAsignado = FORMAS.reduce((suma, forma) => suma + (Number(lineas[forma].monto) || 0), 0);
  const saldoRestante = Math.round((saldoPendiente - totalAsignado) * 100) / 100;

  function validar(): boolean {
    if (totalAsignado <= 0) {
      setErrorMonto('Asigna un monto en al menos una forma de pago.');
      return false;
    }
    // El esquema no impide cobrar de mas (no hay ninguna restriccion que compare
    // la suma de pagos con el total), pero cobrar por encima del saldo dejaria un
    // saldo negativo sin forma de corregirlo: no hay anulaciones ni notas de
    // credito, que el SRS excluye del alcance. Se bloquea aqui.
    if (saldoRestante < 0) {
      setErrorMonto(`El total asignado no puede superar el saldo pendiente (${formatoMoneda(saldoPendiente)}).`);
      return false;
    }
    setErrorMonto(null);
    return true;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      const aCobrar = FORMAS.filter((forma) => Number(lineas[forma].monto) > 0).map((forma) => ({
        id_factura: idFactura,
        monto: Number(lineas[forma].monto),
        forma_pago: forma,
        referencia: lineas[forma].referencia.trim() || null,
      }));
      await registrarPagosMixtos(aCobrar);
      onRegistrado();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar cobro</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Saldo pendiente: {formatoMoneda(saldoPendiente)}
          </Typography>

          <Stack spacing={1.5}>
            {FORMAS.map((forma) => (
              <Stack key={forma} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  label={ETIQUETA_FORMA_PAGO[forma]}
                  type="number"
                  sx={{ width: { sm: 130 } }}
                  value={lineas[forma].monto}
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  onChange={(e) => actualizarMonto(forma, e.target.value)}
                />
                {forma !== 'efectivo' && (
                  <TextField
                    label="Referencia (opcional)"
                    fullWidth
                    value={lineas[forma].referencia}
                    helperText={forma === 'tarjeta' ? 'Número de autorización' : 'Número de transferencia'}
                    slotProps={{ htmlInput: { maxLength: 40 } }}
                    onChange={(e) => actualizarReferencia(forma, e.target.value)}
                  />
                )}
              </Stack>
            ))}
          </Stack>

          {errorMonto && (
            <Typography variant="caption" color="error">
              {errorMonto}
            </Typography>
          )}

          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Asignado: {formatoMoneda(totalAsignado)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600 }}
              color={saldoRestante < 0 ? 'error' : saldoRestante === 0 ? 'success.main' : 'text.primary'}
            >
              Saldo: {formatoMoneda(Math.max(saldoRestante, 0))}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar cobro
        </Button>
      </DialogActions>
    </Dialog>
  );
}
