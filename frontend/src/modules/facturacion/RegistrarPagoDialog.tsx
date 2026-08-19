import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { FormaPago } from '../../types/dominio';
import { registrarPago } from './api';
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

// RF-030 / RN-015: una factura puede cobrarse en uno o varios pagos. No se toca la
// factura al cobrar: su situacion de cobro y su saldo los deriva v_estado_factura
// comparando el total con la suma de los pagos.
export function RegistrarPagoDialog({ idFactura, saldoPendiente, abierto, onCerrar, onRegistrado }: Props) {
  // Se propone el saldo completo, que es el caso habitual en el mostrador; el
  // usuario puede reducirlo para un abono parcial.
  const [monto, setMonto] = useState(String(saldoPendiente));
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo');
  const [referencia, setReferencia] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setMonto(saldoPendiente > 0 ? saldoPendiente.toFixed(2) : '');
    setFormaPago('efectivo');
    setReferencia('');
    setErrores({});
    setErrorGeneral(null);
  }, [abierto, saldoPendiente]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    const montoNum = Number(monto);
    if (monto.trim() === '' || Number.isNaN(montoNum) || montoNum <= 0) {
      nuevosErrores.monto = 'Debe ser un número mayor a 0.';
    } else if (montoNum > saldoPendiente) {
      // El esquema no impide cobrar de mas (no hay ninguna restriccion que compare
      // la suma de pagos con el total), pero cobrar por encima del saldo dejaria un
      // saldo negativo sin forma de corregirlo: no hay anulaciones ni notas de
      // credito, que el SRS excluye del alcance. Se bloquea aqui.
      nuevosErrores.monto = `No puede superar el saldo pendiente (${formatoMoneda(saldoPendiente)}).`;
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await registrarPago({
        id_factura: idFactura,
        monto: Number(monto),
        forma_pago: formaPago,
        referencia: referencia.trim() || null,
      });
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

          <TextField
            label="Monto"
            type="number"
            required
            fullWidth
            value={monto}
            error={!!errores.monto}
            helperText={errores.monto}
            slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            onChange={(e) => setMonto(e.target.value)}
          />

          <TextField
            select
            label="Forma de pago"
            required
            fullWidth
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPago)}
          >
            {FORMAS.map((forma) => (
              <MenuItem key={forma} value={forma}>
                {ETIQUETA_FORMA_PAGO[forma]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Referencia (opcional)"
            fullWidth
            value={referencia}
            helperText="Número de comprobante, autorización o transferencia."
            slotProps={{ htmlInput: { maxLength: 40 } }}
            onChange={(e) => setReferencia(e.target.value)}
          />
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
