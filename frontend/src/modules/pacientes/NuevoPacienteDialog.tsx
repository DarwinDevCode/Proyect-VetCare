import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { asegurarAccesoPortalAutomatico, buscarPropietarios, crearPaciente, crearPropietario } from './api';
import { mensajeError } from '../../lib/errors';

interface Props {
  abierto: boolean;
  especies: Especie[];
  onCerrar: () => void;
  onCreado: (avisoPortal?: string) => void;
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

// RF-004 + RF-005: registrar un paciente en 2 pasos (propietario, luego
// mascota) en vez de un unico formulario largo -- separa una decision (a
// nombre de quien queda la mascota) del resto de los datos, mas facil de
// escanear bajo presion de tiempo en el mostrador (perfil de Recepcionista,
// SRS 2.3). El propietario sigue pudiendo ser uno ya existente o uno nuevo,
// creado en el mismo flujo (RF-004).
export function NuevoPacienteDialog({ abierto, especies, onCerrar, onCreado }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);

  const [modoPropietario, setModoPropietario] = useState<'existente' | 'nuevo'>('existente');
  const [propietarioExistente, setPropietarioExistente] = useState<Propietario | null>(null);
  const [propietarioNuevo, setPropietarioNuevo] = useState<FormPropietarioNuevo>(PROPIETARIO_VACIO);

  // RF-004: la identificacion ya es UNIQUE en la base (rechaza el duplicado de
  // todas formas), pero descubrir eso recien al guardar -- con los demas campos
  // ya llenos -- es una mala experiencia bajo presion de tiempo. Este aviso es
  // puramente informativo, una capa de UX sobre una restriccion que ya existe;
  // no reemplaza ni debilita esa restriccion.
  const [posibleDuplicado, setPosibleDuplicado] = useState<Propietario | null>(null);

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
    setPaso(1);
    setModoPropietario('existente');
    setPropietarioExistente(null);
    setPropietarioNuevo(PROPIETARIO_VACIO);
    setPosibleDuplicado(null);
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

  // Busca coincidencia exacta de identificacion mientras el usuario escribe (no
  // al guardar): reutiliza buscarPropietarios (RF-007) en vez de una consulta
  // nueva -- ya filtra por ILIKE, aqui solo se exige que el numero completo
  // coincida para no avisar de un "duplicado" con cada digito a medio escribir.
  useEffect(() => {
    if (modoPropietario !== 'nuevo') return;
    const identificacion = propietarioNuevo.identificacion.trim();
    if (identificacion.length < 10) {
      setPosibleDuplicado(null);
      return;
    }
    let vigente = true;
    const temporizador = setTimeout(() => {
      buscarPropietarios(identificacion)
        .then((resultados) => {
          if (!vigente) return;
          setPosibleDuplicado(resultados.find((p) => p.identificacion === identificacion) ?? null);
        })
        .catch(() => {
          /* el aviso de duplicado es informativo; un fallo de red no debe bloquear el alta */
        });
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [modoPropietario, propietarioNuevo.identificacion]);

  function usarPropietarioDuplicado() {
    if (!posibleDuplicado) return;
    setModoPropietario('existente');
    setPropietarioExistente(posibleDuplicado);
    setPropietarioNuevo(PROPIETARIO_VACIO);
    setPosibleDuplicado(null);
  }

  function validarPaso1(): boolean {
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
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function validarPaso2(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!nombre.trim()) nuevosErrores.nombre = 'Obligatorio.';
    if (!idEspecie) nuevosErrores.especie = 'Obligatorio.';
    if (!sexo) nuevosErrores.sexo = 'Obligatorio.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function siguiente() {
    setErrorGeneral(null);
    if (validarPaso1()) setPaso(2);
  }

  async function guardar() {
    setErrorGeneral(null);
    if (!validarPaso2()) return;

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

      // Ampliación posterior a la Fase 5 (CLAUDE.md sección 14): asegura el
      // acceso al portal del propietario en el mismo alta, sin que Recepción
      // tenga que abrir "Dar acceso al portal" aparte. Try/catch propio, no el
      // de arriba: el paciente ya quedó guardado, así que un problema acá nunca
      // debe mostrarse como si el alta hubiera fallado -- a lo sumo, un aviso.
      let avisoPortal: string | undefined;
      try {
        const resultado = await asegurarAccesoPortalAutomatico(idPropietario);
        if (resultado.omitido === 'sin_correo') {
          avisoPortal = 'Paciente registrado. No se creó acceso al portal: el propietario no tiene correo registrado.';
        } else if (resultado.envioCorreoFallido) {
          avisoPortal =
            'Paciente registrado y cuenta de portal creada, pero no se pudo enviar el correo. Puedes reenviarlo desde la ficha del propietario.';
        }
        // omitido === 'ya_existe' o éxito completo: nada nuevo que avisar.
      } catch {
        avisoPortal =
          'Paciente registrado. No se pudo verificar el acceso al portal automáticamente; puedes emitirlo desde la ficha del propietario.';
      }

      onCreado(avisoPortal);
      cerrar();
    } catch (error) {
      setErrorGeneral(mensajeError(error));
      // Un fallo en el paso 2 (p. ej. de red) no debe obligar a repetir el paso
      // 1: el propietario elegido/completado se conserva, el usuario solo
      // reintenta desde aqui.
    } finally {
      setGuardando(false);
    }
  }

  const resumenPropietario =
    modoPropietario === 'existente'
      ? propietarioExistente
        ? `${propietarioExistente.nombres} ${propietarioExistente.apellidos}`
        : null
      : propietarioNuevo.nombres && propietarioNuevo.apellidos
        ? `${propietarioNuevo.nombres} ${propietarioNuevo.apellidos} (nuevo)`
        : null;

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar nuevo paciente</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {errorGeneral && <Alert severity="error">{errorGeneral}</Alert>}

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              label="1 · Propietario"
              size="small"
              color={paso === 1 ? 'primary' : 'default'}
              variant={paso === 1 ? 'filled' : 'outlined'}
            />
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
            <Chip
              label="2 · Mascota"
              size="small"
              color={paso === 2 ? 'primary' : 'default'}
              variant={paso === 2 ? 'filled' : 'outlined'}
            />
            {paso === 2 && resumenPropietario && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {resumenPropietario}
              </Typography>
            )}
          </Stack>

          {paso === 1 ? (
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

                  {posibleDuplicado && (
                    <Alert
                      severity="warning"
                      variant="outlined"
                      action={
                        <Button color="inherit" size="small" onClick={usarPropietarioDuplicado}>
                          Usar este propietario
                        </Button>
                      }
                    >
                      Ya existe un propietario con esta identificación:{' '}
                      {posibleDuplicado.nombres} {posibleDuplicado.apellidos}.
                    </Alert>
                  )}

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
          ) : (
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
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        {paso === 2 && (
          <Button onClick={() => setPaso(1)} disabled={guardando}>
            Atrás
          </Button>
        )}
        {paso === 1 ? (
          <Button variant="contained" onClick={siguiente}>
            Siguiente
          </Button>
        ) : (
          <Button variant="contained" onClick={guardar} loading={guardando}>
            Registrar paciente
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
