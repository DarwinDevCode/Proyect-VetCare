import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import dayjs, { type Dayjs } from 'dayjs';
import type { EventoHistorial, Especie, PacienteConFicha } from '../../types/dominio';
import { EspecieRazaSelect } from './EspecieRazaSelect';
import { AccesoPortalDialog } from './AccesoPortalDialog';
import { ReenviarAccesoPortalDialog } from './ReenviarAccesoPortalDialog';
import { actualizarPaciente, actualizarPropietario } from './api';
import { listarCitasPorPaciente, type CitaResumen } from '../agenda/api';
import { listarHistorial } from '../historial/api';
import { interpretarEvento, ETIQUETA_TIPO_EVENTO, COLOR_TIPO_EVENTO } from '../historial/eventoHistorial';
import { mensajeError } from '../../lib/errors';
import { calcularEdadTexto } from './edad';
import { useAuth } from '../../auth/AuthContext';

interface Props {
  ficha: PacienteConFicha | null;
  especies: Especie[];
  puedeEditar: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

type Pestana = 'resumen' | 'citas' | 'historial' | 'vacunas';

// RF-007: ver ficha (paciente + propietario) como una unidad. RF-008/RF-009:
// editar cada parte por separado sin perder el vinculo entre ambas. Solo
// Recepcionista edita (matriz de acceso, SRS 3.8); el servidor lo exige por RLS,
// pero ademas no mostramos la accion si el rol no puede completarla.
//
// Pestanas "Historial"/"Vacunas" (RN-006: solo Veterinario consulta informacion
// clinica) se ofrecen unicamente a ese rol -- Recepcionista tambien abre esta
// ficha (RF-004/RF-008), pero mostrarle una pestana que la RLS de todas formas
// vaciaria seria el mismo antipatron que ya se evito en el Modulo 4 (no ofrecer
// una interaccion que de todas formas fallaria). La pestana "Facturas" del
// wireframe original no se incluyo en esta pasada: una factura se vincula a
// propietario o a consulta, no directamente a paciente, y un dueno con varias
// mascotas complicaria el filtro sin una decision de producto previa sobre que
// significa "las facturas de esta mascota" -- queda fuera de este alcance.
export function FichaDialog({ ficha, especies, puedeEditar, onCerrar, onActualizado }: Props) {
  const { sesion } = useAuth();
  const esVeterinario = sesion?.rol.codigo === 'veterinario';

  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [citas, setCitas] = useState<CitaResumen[]>([]);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);
  const [cargandoPestana, setCargandoPestana] = useState(false);
  const [errorPestana, setErrorPestana] = useState<string | null>(null);

  const [editandoPropietario, setEditandoPropietario] = useState(false);
  const [dialogoAccesoAbierto, setDialogoAccesoAbierto] = useState(false);
  const [dialogoReenvioAbierto, setDialogoReenvioAbierto] = useState(false);
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
    setPestana('resumen');
  }, [ficha]);

  // Cada pestana carga sus datos solo al abrirse, no todas de una al abrir la
  // ficha -- evita 2-3 consultas de mas cuando el usuario solo quiere ver el
  // resumen (el caso mas comun).
  useEffect(() => {
    if (!ficha) return;
    if (pestana === 'resumen') return;

    let vigente = true;
    setCargandoPestana(true);
    setErrorPestana(null);

    const cargar =
      pestana === 'citas'
        ? listarCitasPorPaciente(ficha.id_paciente).then((datos) => vigente && setCitas(datos))
        : listarHistorial(ficha.id_paciente).then((datos) => vigente && setHistorial(datos));

    cargar
      .catch((err) => vigente && setErrorPestana(mensajeError(err)))
      .finally(() => vigente && setCargandoPestana(false));

    return () => {
      vigente = false;
    };
  }, [ficha, pestana]);

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
    <>
    <Dialog open={!!ficha} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Ficha de {ficha.nombre}
        <IconButton sx={{ ml: 'auto' }} onClick={onCerrar}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={pestana}
        onChange={(_e, valor: Pestana) => setPestana(valor)}
        variant="scrollable"
        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="resumen" label="Resumen" />
        <Tab value="citas" label="Citas" />
        {esVeterinario && <Tab value="historial" label="Historial" />}
        {esVeterinario && <Tab value="vacunas" label="Vacunas" />}
      </Tabs>

      <DialogContent dividers>
        {pestana === 'resumen' && (
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
                  {puedeEditar &&
                    (ficha.propietario.id_usuario_portal ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center', alignSelf: 'flex-start' }}>
                        <Chip label="Con acceso al portal" size="small" color="success" variant="outlined" />
                        <Button size="small" onClick={() => setDialogoReenvioAbierto(true)}>
                          Reenviar acceso
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        size="small"
                        sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                        onClick={() => setDialogoAccesoAbierto(true)}
                      >
                        Dar acceso al portal
                      </Button>
                    ))}
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
        )}

        {pestana !== 'resumen' && (
          <Box sx={{ minHeight: 120 }}>
            {errorPestana && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorPestana}
              </Alert>
            )}
            {cargandoPestana ? (
              <Stack sx={{ alignItems: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : pestana === 'citas' ? (
              citas.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin citas registradas.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {citas.map((cita) => (
                    <Box key={cita.id_cita}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {dayjs(cita.fecha_hora_inicio).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                        <Chip
                          label={cita.estado}
                          size="small"
                          color={cita.estado === 'cancelada' ? 'default' : 'primary'}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {cita.motivo || 'Sin motivo registrado'} · Dr(a). {cita.veterinario.nombres}{' '}
                        {cita.veterinario.apellidos}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )
            ) : (
              // historial / vacunas: mismo arreglo v_historial_clinico, filtrado
              // por tipo aqui -- no hace falta una consulta por pestana.
              (() => {
                const eventos = historial.filter((e) =>
                  pestana === 'vacunas' ? e.tipo_evento === 'vacunacion' : true,
                );
                if (eventos.length === 0) {
                  return (
                    <Typography variant="body2" color="text.secondary">
                      {pestana === 'vacunas' ? 'Sin vacunas registradas.' : 'Sin historial clínico registrado.'}
                    </Typography>
                  );
                }
                return (
                  <Stack spacing={1.5}>
                    {eventos.map((evento) => {
                      const interpretado = interpretarEvento(evento);
                      return (
                        <Box key={`${evento.tipo_evento}-${evento.id_evento}`}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Chip
                              label={ETIQUETA_TIPO_EVENTO[evento.tipo_evento]}
                              size="small"
                              color={COLOR_TIPO_EVENTO[evento.tipo_evento]}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {dayjs(evento.fecha.slice(0, 10)).format('DD/MM/YYYY')}
                            </Typography>
                          </Stack>
                          {interpretado.tipo === 'consulta' && (
                            <Typography variant="body2">{interpretado.motivo}</Typography>
                          )}
                          {interpretado.tipo === 'vacunacion' && (
                            <Typography variant="body2">{interpretado.producto}</Typography>
                          )}
                          {interpretado.tipo === 'examen' && (
                            <Typography variant="body2">{interpretado.tipoExamen}</Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                );
              })()
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>

    <AccesoPortalDialog
      propietario={dialogoAccesoAbierto ? ficha.propietario : null}
      onCerrar={() => setDialogoAccesoAbierto(false)}
      onEmitido={onActualizado}
    />

    <ReenviarAccesoPortalDialog
      propietario={dialogoReenvioAbierto ? ficha.propietario : null}
      onCerrar={() => setDialogoReenvioAbierto(false)}
      onReenviado={onActualizado}
    />
    </>
  );
}
