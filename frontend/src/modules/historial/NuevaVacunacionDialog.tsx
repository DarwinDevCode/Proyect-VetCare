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
} from '@mui/material';
import dayjs from 'dayjs';
import { crearVacunacion, listarProductosVacuna, obtenerProximaVacuna, type ProductoVacuna } from './api';
import { mensajeError } from '../../lib/errors';
import type { VacunaProxima } from '../../types/dominio';

interface Props {
  idPaciente: number;
  // Definido cuando se abre "dentro de una consulta" (RF-018); undefined cuando se
  // abre de forma independiente desde el boton general de la pagina.
  idConsulta?: number;
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

// RF-018: registrar la aplicacion de una vacuna, indicando producto y dosis. El
// descuento de inventario lo dispara automaticamente el trigger ya existente al
// insertar -- este dialogo nunca toca movimiento_inventario directamente.
export function NuevaVacunacionDialog({ idPaciente, idConsulta, abierto, onCerrar, onCreado }: Props) {
  const [productos, setProductos] = useState<ProductoVacuna[]>([]);
  const [idProducto, setIdProducto] = useState<number | ''>('');
  const [dosis, setDosis] = useState('');
  const [lote, setLote] = useState('');
  // RF-041: referencia de ultima/proxima aplicacion de la vacuna elegida para este
  // paciente -- solo informativa, no bloquea ni prellena nada.
  const [proximaVacuna, setProximaVacuna] = useState<VacunaProxima | null>(null);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setIdProducto('');
    setDosis('');
    setLote('');
    setProximaVacuna(null);
    setErrores({});
    setErrorGeneral(null);
    listarProductosVacuna()
      .then(setProductos)
      .catch((err) => setErrorGeneral(mensajeError(err)));
  }, [abierto]);

  useEffect(() => {
    if (!idProducto) {
      setProximaVacuna(null);
      return;
    }
    let vigente = true;
    obtenerProximaVacuna(idPaciente, idProducto)
      .then((resultado) => vigente && setProximaVacuna(resultado))
      .catch(() => vigente && setProximaVacuna(null));
    return () => {
      vigente = false;
    };
  }, [idPaciente, idProducto]);

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!idProducto) nuevosErrores.producto = 'Selecciona una vacuna.';
    const dosisNum = Number(dosis);
    if (dosis.trim() === '' || Number.isNaN(dosisNum) || dosisNum <= 0) {
      nuevosErrores.dosis = 'Debe ser un número mayor a 0.';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await crearVacunacion({
        id_paciente: idPaciente,
        id_producto: idProducto as number,
        id_consulta: idConsulta ?? null,
        dosis: Number(dosis),
        lote: lote.trim() || null,
      });
      onCreado();
      onCerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Nueva vacunación</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <TextField
            select
            label="Vacuna"
            required
            fullWidth
            value={idProducto}
            error={!!errores.producto}
            helperText={errores.producto || (productos.length === 0 ? 'No hay vacunas activas en el catálogo.' : '')}
            onChange={(e) => setIdProducto(e.target.value ? Number(e.target.value) : '')}
          >
            {productos.map((p) => (
              <MenuItem key={p.id_producto} value={p.id_producto}>
                {p.nombre}
              </MenuItem>
            ))}
          </TextField>

          {proximaVacuna && (
            <Alert severity="info">
              Última aplicación: {dayjs(proximaVacuna.ultima_aplicacion).format('DD/MM/YYYY')}.
              Próxima dosis sugerida: {dayjs(proximaVacuna.proxima_fecha).format('DD/MM/YYYY')}.
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Dosis"
              type="number"
              required
              fullWidth
              value={dosis}
              error={!!errores.dosis}
              helperText={errores.dosis}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              onChange={(e) => setDosis(e.target.value)}
            />
            <TextField
              label="Lote (opcional)"
              fullWidth
              value={lote}
              slotProps={{ htmlInput: { maxLength: 30 } }}
              onChange={(e) => setLote(e.target.value)}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar vacunación
        </Button>
      </DialogActions>
    </Dialog>
  );
}
