import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import type { Especie, Raza } from '../../types/dominio';
import { actualizarEspecie, actualizarRaza, crearEspecie, crearRaza, listarEspecies, listarRazas } from './api';
import { mensajeError } from '../../lib/errors';

// AD-13: especies y razas administrables desde la aplicacion. RNF-024 exige
// poder "incorporar nuevas especies, razas y productos sin modificar la
// estructura de la base de datos" -- antes de esta pantalla, la unica forma
// de ampliarlas era editando supabase/seed.sql o insertando por SQL directo,
// lo que en la practica contradecia el espiritu del requisito cada vez que
// hacia falta un valor nuevo.
export function CatalogosTab() {
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [razas, setRazas] = useState<Raza[]>([]);
  const [idEspecieSeleccionada, setIdEspecieSeleccionada] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevaEspecie, setNuevaEspecie] = useState('');
  const [nuevaRaza, setNuevaRaza] = useState('');
  const [edicion, setEdicion] = useState<{ tipo: 'especie' | 'raza'; id: number; valor: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [listaEspecies, listaRazas] = await Promise.all([listarEspecies(), listarRazas()]);
      setEspecies(listaEspecies);
      setRazas(listaRazas);
      setIdEspecieSeleccionada((actual) => actual ?? listaEspecies[0]?.id_especie ?? null);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const razasVisibles = useMemo(
    () => razas.filter((r) => r.id_especie === idEspecieSeleccionada),
    [razas, idEspecieSeleccionada],
  );

  async function agregarEspecie() {
    if (!nuevaEspecie.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const creada = await crearEspecie(nuevaEspecie.trim());
      setNuevaEspecie('');
      await recargar();
      setIdEspecieSeleccionada(creada.id_especie);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function agregarRaza() {
    if (!nuevaRaza.trim() || !idEspecieSeleccionada) return;
    setGuardando(true);
    setError(null);
    try {
      await crearRaza(idEspecieSeleccionada, nuevaRaza.trim());
      setNuevaRaza('');
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!edicion || !edicion.valor.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      if (edicion.tipo === 'especie') await actualizarEspecie(edicion.id, edicion.valor.trim());
      else await actualizarRaza(edicion.id, edicion.valor.trim());
      setEdicion(null);
      await recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {cargando && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cargando catálogos…
        </Typography>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 5 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Especies
            </Typography>
            <List dense disablePadding>
              {especies.map((especie) => (
                <FilaCatalogo
                  key={especie.id_especie}
                  texto={especie.nombre}
                  seleccionada={especie.id_especie === idEspecieSeleccionada}
                  enEdicion={edicion?.tipo === 'especie' && edicion.id === especie.id_especie}
                  valorEdicion={edicion?.valor ?? ''}
                  onSeleccionar={() => setIdEspecieSeleccionada(especie.id_especie)}
                  onIniciarEdicion={() => setEdicion({ tipo: 'especie', id: especie.id_especie, valor: especie.nombre })}
                  onCambiarEdicion={(v) => setEdicion((e) => (e ? { ...e, valor: v } : e))}
                  onGuardarEdicion={guardarEdicion}
                  onCancelarEdicion={() => setEdicion(null)}
                />
              ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <TextField
                size="small"
                placeholder="Nueva especie…"
                fullWidth
                value={nuevaEspecie}
                onChange={(e) => setNuevaEspecie(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agregarEspecie()}
              />
              <IconButton color="primary" disabled={guardando || !nuevaEspecie.trim()} onClick={agregarEspecie}>
                <AddIcon />
              </IconButton>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 7 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Razas {especies.find((e) => e.id_especie === idEspecieSeleccionada)?.nombre ? `— ${especies.find((e) => e.id_especie === idEspecieSeleccionada)?.nombre}` : ''}
            </Typography>
            {!idEspecieSeleccionada ? (
              <Typography variant="body2" color="text.secondary">
                Selecciona una especie para ver o agregar sus razas.
              </Typography>
            ) : (
              <>
                <List dense disablePadding>
                  {razasVisibles.map((raza) => (
                    <FilaCatalogo
                      key={raza.id_raza}
                      texto={raza.nombre}
                      enEdicion={edicion?.tipo === 'raza' && edicion.id === raza.id_raza}
                      valorEdicion={edicion?.valor ?? ''}
                      onIniciarEdicion={() => setEdicion({ tipo: 'raza', id: raza.id_raza, valor: raza.nombre })}
                      onCambiarEdicion={(v) => setEdicion((e) => (e ? { ...e, valor: v } : e))}
                      onGuardarEdicion={guardarEdicion}
                      onCancelarEdicion={() => setEdicion(null)}
                    />
                  ))}
                  {razasVisibles.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      Esta especie todavía no tiene razas registradas — "mestizo" incluida.
                    </Typography>
                  )}
                </List>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Nueva raza…"
                    fullWidth
                    value={nuevaRaza}
                    onChange={(e) => setNuevaRaza(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && agregarRaza()}
                  />
                  <IconButton color="primary" disabled={guardando || !nuevaRaza.trim()} onClick={agregarRaza}>
                    <AddIcon />
                  </IconButton>
                </Stack>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

interface FilaCatalogoProps {
  texto: string;
  seleccionada?: boolean;
  enEdicion: boolean;
  valorEdicion: string;
  onSeleccionar?: () => void;
  onIniciarEdicion: () => void;
  onCambiarEdicion: (valor: string) => void;
  onGuardarEdicion: () => void;
  onCancelarEdicion: () => void;
}

function FilaCatalogo({
  texto,
  seleccionada,
  enEdicion,
  valorEdicion,
  onSeleccionar,
  onIniciarEdicion,
  onCambiarEdicion,
  onGuardarEdicion,
  onCancelarEdicion,
}: FilaCatalogoProps) {
  if (enEdicion) {
    return (
      <ListItem disablePadding sx={{ py: 0.25 }}>
        <Stack direction="row" spacing={0.5} sx={{ width: '100%', alignItems: 'center', px: 1 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            value={valorEdicion}
            onChange={(e) => onCambiarEdicion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onGuardarEdicion()}
          />
          <IconButton size="small" color="primary" onClick={onGuardarEdicion}>
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onCancelarEdicion}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </ListItem>
    );
  }

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <IconButton size="small" edge="end" onClick={onIniciarEdicion}>
          <EditIcon fontSize="small" />
        </IconButton>
      }
    >
      {onSeleccionar ? (
        <ListItemButton selected={seleccionada} onClick={onSeleccionar} sx={{ borderRadius: 1 }}>
          <ListItemText primary={texto} />
        </ListItemButton>
      ) : (
        <ListItemText primary={texto} sx={{ px: 2 }} />
      )}
    </ListItem>
  );
}
