import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import dayjs, { type Dayjs } from 'dayjs';
import type { Especie, PacienteConFicha } from '../../types/dominio';
import { EspecieRazaSelect } from './EspecieRazaSelect';
import { actualizarPaciente, actualizarPropietario } from './api';
import { mensajeError } from '../../lib/errors';
import { calcularEdadTexto } from './edad';

interface Props {
  ficha: PacienteConFicha | null;
  especies: Especie[];
  puedeEditar: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

// RF-007: ver ficha (paciente + propietario) como una unidad. RF-008/RF-009:
// editar cada parte por separado sin perder el vinculo entre ambas. Solo
// Recepcionista edita (matriz de acceso, SRS 3.8); el servidor lo exige por RLS,
// pero ademas no mostramos la accion si el rol no puede completarla.
export function FichaDialog({ ficha, especies, puedeEditar, onCerrar, onActualizado }: Props) {
  const [editandoPropietario, setEditandoPropietario] = useState(false);
  const [editandoPaciente, setEditandoPaciente] = useState(false);

  const [formPropietario, setFormPropietario] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
    telefonoAlterno: '',
    correo: '',
    direccion: '',
  });

  const [formPaciente, setFormPaciente] = useState({
    nombre: '',
    idEspecie: '' as number | '',
    idRaza: '' as number | '',
    color: '',
  });
  const [fechaNacimiento, setFechaNacimiento] = useState<Dayjs | null>(null);

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!ficha) return;
    setFormPropietario({
      nombres: ficha.propietario.nombres,
      apellidos: ficha.propietario.apellidos,
      telefono: ficha.propietario.telefono,
      telefonoAlterno: ficha.propietario.telefono_alterno ?? '',
      correo: ficha.propietario.correo ?? '',
      direccion: ficha.propietario.direccion ?? '',
    });
    setFormPaciente({
      nombre: ficha.nombre,
      idEspecie: ficha.id_especie,
      idRaza: ficha.id_raza ?? '',
      color: ficha.color ?? '',
    });
    setFechaNacimiento(ficha.fecha_nacimiento ? dayjs(ficha.fecha_nacimiento) : null);
    setEditandoPropietario(false);
    setEditandoPaciente(false);
    setErrorGeneral(null);
  }, [ficha]);

  if (!ficha) return null;

  async function guardarPropietario() {
    setGuardando(true);
    setErrorGeneral(null);
    try {
      await actualizarPropietario(ficha!.id_propietario, {
        nombres: formPropietario.nombres.trim(),
        apellidos: formPropietario.apellidos.trim(),
        telefono: formPropietario.telefono.trim(),
        telefono_alterno: formPropietario.telefonoAlterno.trim() || null,
        correo: formPropietario.correo.trim() || null,
        direccion: formPropietario.direccion.trim() || null,
      });
      setEditandoPropietario(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPaciente() {
    setGuardando(true);
    setErrorGeneral(null);
    try {
      await actualizarPaciente(ficha!.id_paciente, {
        nombre: formPaciente.nombre.trim(),
        id_especie: formPaciente.idEspecie as number,
        id_raza: formPaciente.idRaza || null,
        color: formPaciente.color.trim() || null,
        fecha_nacimiento: fechaNacimiento ? fechaNacimiento.format('YYYY-MM-DD') : null,
      });
      setEditandoPaciente(false);
      onActualizado();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={!!ficha} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Ficha de {ficha.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Propietario</Typography>
              {puedeEditar && !editandoPropietario && (
                <IconButton size="small" onClick={() => setEditandoPropietario(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            {editandoPropietario ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Nombres"
                    fullWidth
                    value={formPropietario.nombres}
                    onChange={(e) => setFormPropietario((f) => ({ ...f, nombres: e.target.value }))}
                  />
                  <TextField
                    label="Apellidos"
                    fullWidth
                    value={formPropietario.apellidos}
                    onChange={(e) => setFormPropietario((f) => ({ ...f, apellidos: e.target.value }))}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Teléfono"
                    fullWidth
                    value={formPropietario.telefono}
                    onChange={(e) => setFormPropietario((f) => ({ ...f, telefono: e.target.value }))}
                  />
                  <TextField
                    label="Teléfono alterno"
                    fullWidth
                    value={formPropietario.telefonoAlterno}
                    onChange={(e) =>
                      setFormPropietario((f) => ({ ...f, telefonoAlterno: e.target.value }))
                    }
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Correo"
                    fullWidth
                    value={formPropietario.correo}
                    onChange={(e) => setFormPropietario((f) => ({ ...f, correo: e.target.value }))}
                  />
                  <TextField
                    label="Dirección"
                    fullWidth
                    value={formPropietario.direccion}
                    onChange={(e) => setFormPropietario((f) => ({ ...f, direccion: e.target.value }))}
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditandoPropietario(false)} disabled={guardando}>
                    Cancelar
                  </Button>
                  <Button variant="contained" onClick={guardarPropietario} loading={guardando}>
                    Guardar
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {ficha.propietario.nombres} {ficha.propietario.apellidos} — {ficha.propietario.identificacion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tel: {ficha.propietario.telefono}
                  {ficha.propietario.telefono_alterno ? ` / ${ficha.propietario.telefono_alterno}` : ''}
                </Typography>
                {ficha.propietario.correo && (
                  <Typography variant="body2" color="text.secondary">
                    {ficha.propietario.correo}
                  </Typography>
                )}
                {ficha.propietario.direccion && (
                  <Typography variant="body2" color="text.secondary">
                    {ficha.propietario.direccion}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Mascota</Typography>
              {puedeEditar && !editandoPaciente && (
                <IconButton size="small" onClick={() => setEditandoPaciente(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            {editandoPaciente ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Nombre"
                  fullWidth
                  value={formPaciente.nombre}
                  onChange={(e) => setFormPaciente((f) => ({ ...f, nombre: e.target.value }))}
                />
                <EspecieRazaSelect
                  especies={especies}
                  idEspecie={formPaciente.idEspecie}
                  idRaza={formPaciente.idRaza}
                  onChangeEspecie={(id) => setFormPaciente((f) => ({ ...f, idEspecie: id }))}
                  onChangeRaza={(id) => setFormPaciente((f) => ({ ...f, idRaza: id }))}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <DatePicker
                    label="Fecha de nacimiento"
                    value={fechaNacimiento}
                    onChange={setFechaNacimiento}
                    maxDate={dayjs()}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <TextField
                    label="Color"
                    fullWidth
                    value={formPaciente.color}
                    onChange={(e) => setFormPaciente((f) => ({ ...f, color: e.target.value }))}
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditandoPaciente(false)} disabled={guardando}>
                    Cancelar
                  </Button>
                  <Button variant="contained" onClick={guardarPaciente} loading={guardando}>
                    Guardar
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {ficha.especie.nombre}
                  {ficha.raza ? ` · ${ficha.raza.nombre}` : ' · Mestizo'} ·{' '}
                  {ficha.sexo === 'M' ? 'Macho' : 'Hembra'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calcularEdadTexto(ficha.fecha_nacimiento)}
                  {ficha.color ? ` · ${ficha.color}` : ''}
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
