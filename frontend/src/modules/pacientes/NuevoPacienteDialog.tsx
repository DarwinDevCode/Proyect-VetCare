import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import type { Especie, Propietario, Sexo } from '../../types/dominio';
import { PropietarioAutocomplete } from './PropietarioAutocomplete';
import { EspecieRazaSelect } from './EspecieRazaSelect';
import { crearPaciente, crearPropietario } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  especies: Especie[];
  onCerrar: () => void;
  onCreado: () => void;
}

interface FormPropietarioNuevo {
  identificacion: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  telefonoAlterno: string;
  correo: string;
  direccion: string;
}

const PROPIETARIO_VACIO: FormPropietarioNuevo = {
  identificacion: '',
  nombres: '',
  apellidos: '',
  telefono: '',
  telefonoAlterno: '',
  correo: '',
  direccion: '',
};

// RF-004 + RF-005: un unico flujo para registrar un paciente, permitiendo elegir
// un propietario ya existente o registrar uno nuevo en el mismo paso (reduce
// la cantidad de pasos para completar la tarea, como pide el criterio de UX).
export function NuevoPacienteDialog({ abierto, especies, onCerrar, onCreado }: Props) {
  const [modoPropietario, setModoPropietario] = useState<'existente' | 'nuevo'>('existente');
  const [propietarioExistente, setPropietarioExistente] = useState<Propietario | null>(null);
  const [propietarioNuevo, setPropietarioNuevo] = useState<FormPropietarioNuevo>(PROPIETARIO_VACIO);

  const [nombre, setNombre] = useState('');
  const [idEspecie, setIdEspecie] = useState<number | ''>('');
  const [idRaza, setIdRaza] = useState<number | ''>('');
  const [sexo, setSexo] = useState<Sexo | ''>('');
  const [fechaNacimiento, setFechaNacimiento] = useState<Dayjs | null>(null);
  const [color, setColor] = useState('');

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function reiniciar() {
    setModoPropietario('existente');
    setPropietarioExistente(null);
    setPropietarioNuevo(PROPIETARIO_VACIO);
    setNombre('');
    setIdEspecie('');
    setIdRaza('');
    setSexo('');
    setFechaNacimiento(null);
    setColor('');
    setErrores({});
    setErrorGeneral(null);
  }

  function cerrar() {
    reiniciar();
    onCerrar();
  }

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (modoPropietario === 'existente' && !propietarioExistente) {
      nuevosErrores.propietario = 'Selecciona un propietario o registra uno nuevo.';
    }
    if (modoPropietario === 'nuevo') {
      if (propietarioNuevo.identificacion.trim().length < 10) {
        nuevosErrores.identificacion = 'La identificación debe tener al menos 10 caracteres.';
      }
      if (!propietarioNuevo.nombres.trim()) nuevosErrores.nombresPropietario = 'Obligatorio.';
      if (!propietarioNuevo.apellidos.trim()) nuevosErrores.apellidosPropietario = 'Obligatorio.';
      if (!propietarioNuevo.telefono.trim()) nuevosErrores.telefono = 'Obligatorio.';
    }

    if (!nombre.trim()) nuevosErrores.nombre = 'Obligatorio.';
    if (!idEspecie) nuevosErrores.especie = 'Obligatorio.';
    if (!sexo) nuevosErrores.sexo = 'Obligatorio.';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      let idPropietario: number;

      if (modoPropietario === 'existente') {
        idPropietario = propietarioExistente!.id_propietario;
      } else {
        const creado = await crearPropietario({
          identificacion: propietarioNuevo.identificacion.trim(),
          nombres: propietarioNuevo.nombres.trim(),
          apellidos: propietarioNuevo.apellidos.trim(),
          telefono: propietarioNuevo.telefono.trim(),
          telefono_alterno: propietarioNuevo.telefonoAlterno.trim() || null,
          correo: propietarioNuevo.correo.trim() || null,
          direccion: propietarioNuevo.direccion.trim() || null,
        });
        idPropietario = creado.id_propietario;
      }

      await crearPaciente({
        id_propietario: idPropietario,
        id_especie: idEspecie as number,
        id_raza: idRaza || null,
        nombre: nombre.trim(),
        sexo: sexo as Sexo,
        fecha_nacimiento: fechaNacimiento ? fechaNacimiento.format('YYYY-MM-DD') : null,
        color: color.trim() || null,
      });

      onCreado();
      cerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar nuevo paciente</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Propietario
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={modoPropietario}
              onChange={(_, val) => val && setModoPropietario(val)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="existente">Ya registrado</ToggleButton>
              <ToggleButton value="nuevo">Registrar nuevo</ToggleButton>
            </ToggleButtonGroup>

            {modoPropietario === 'existente' ? (
              <PropietarioAutocomplete
                value={propietarioExistente}
                onChange={setPropietarioExistente}
                error={errores.propietario}
              />
            ) : (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Identificación"
                    required
                    fullWidth
                    value={propietarioNuevo.identificacion}
                    error={!!errores.identificacion}
                    helperText={errores.identificacion}
                    onChange={(e) =>
                      setPropietarioNuevo((p) => ({ ...p, identificacion: e.target.value }))
                    }
                  />
                  <TextField
                    label="Teléfono"
                    required
                    fullWidth
                    value={propietarioNuevo.telefono}
                    error={!!errores.telefono}
                    helperText={errores.telefono}
                    onChange={(e) => setPropietarioNuevo((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Nombres"
                    required
                    fullWidth
                    value={propietarioNuevo.nombres}
                    error={!!errores.nombresPropietario}
                    helperText={errores.nombresPropietario}
                    onChange={(e) => setPropietarioNuevo((p) => ({ ...p, nombres: e.target.value }))}
                  />
                  <TextField
                    label="Apellidos"
                    required
                    fullWidth
                    value={propietarioNuevo.apellidos}
                    error={!!errores.apellidosPropietario}
                    helperText={errores.apellidosPropietario}
                    onChange={(e) => setPropietarioNuevo((p) => ({ ...p, apellidos: e.target.value }))}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Correo (opcional)"
                    type="email"
                    fullWidth
                    value={propietarioNuevo.correo}
                    onChange={(e) => setPropietarioNuevo((p) => ({ ...p, correo: e.target.value }))}
                  />
                  <TextField
                    label="Dirección (opcional)"
                    fullWidth
                    value={propietarioNuevo.direccion}
                    onChange={(e) => setPropietarioNuevo((p) => ({ ...p, direccion: e.target.value }))}
                  />
                </Stack>
              </Stack>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Mascota
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Nombre"
                required
                fullWidth
                value={nombre}
                error={!!errores.nombre}
                helperText={errores.nombre}
                onChange={(e) => setNombre(e.target.value)}
              />

              <EspecieRazaSelect
                especies={especies}
                idEspecie={idEspecie}
                idRaza={idRaza}
                onChangeEspecie={setIdEspecie}
                onChangeRaza={setIdRaza}
                errorEspecie={errores.especie}
              />

              <Box>
                <Typography variant="body2" color={errores.sexo ? 'error' : 'text.secondary'}>
                  Sexo *
                </Typography>
                <RadioGroup row value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
                  <FormControlLabel value="M" control={<Radio />} label="Macho" />
                  <FormControlLabel value="H" control={<Radio />} label="Hembra" />
                </RadioGroup>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <DatePicker
                  label="Fecha de nacimiento (opcional)"
                  value={fechaNacimiento}
                  onChange={setFechaNacimiento}
                  maxDate={dayjs()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'Déjalo vacío si se desconoce (ej. animal rescatado)',
                    },
                  }}
                />
                <TextField
                  label="Color (opcional)"
                  fullWidth
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Registrar paciente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
