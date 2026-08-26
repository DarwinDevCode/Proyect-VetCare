import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import PetsIcon from '@mui/icons-material/Pets';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import dayjs from 'dayjs';
import { useAuth } from '../../auth/AuthContext';
import { mensajeError } from '../../lib/errors';
import { formatoMoneda } from '../facturacion/formato';
import type { CitaConDetalle } from '../../types/dominio';
import {
  obtenerResumenAdministrador,
  obtenerResumenRecepcionista,
  obtenerResumenVeterinario,
  type ResumenAdministrador,
  type ResumenRecepcionista,
  type ResumenVeterinario,
} from './api';

// Fase 6 (1a): "/inicio" reemplaza al redirect por rol que hacia InicioPorRol
// (App.tsx) -- KPIs, agenda del dia y accesos rapidos, todo sobre datos que el
// rol ya puede leer (RLS), sin migracion ni vista nueva (ver dashboard/api.ts).
// El contenido varia por rol porque los KPIs del proyecto tambien lo hacen: no
// tendria sentido ofrecerle "ingresos de hoy" a un Veterinario, que no tiene
// acceso a Facturacion.

function TarjetaKpi({ etiqueta, valor, icono, alerta }: { etiqueta: string; valor: string; icono: ReactNode; alerta?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            display: 'flex',
            p: 1,
            borderRadius: 999,
            bgcolor: alerta ? 'warning.light' : 'primary.light',
            color: alerta ? 'warning.dark' : 'primary.dark',
          }}
        >
          {icono}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {etiqueta}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {valor}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ListaCitasHoy({ citas, textoVacio }: { citas: CitaConDetalle[]; textoVacio: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Agenda de hoy
      </Typography>
      {citas.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {textoVacio}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {citas.slice(0, 6).map((cita) => (
            <Stack
              key={cita.id_cita}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', py: 0.5 }}
            >
              <Chip
                size="small"
                label={dayjs(cita.fecha_hora_inicio).format('HH:mm')}
                sx={{ minWidth: 64, fontWeight: 600 }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {cita.paciente.nombre} — {cita.paciente.propietario.nombres}{' '}
                  {cita.paciente.propietario.apellidos}
                </Typography>
                {cita.motivo && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {cita.motivo}
                  </Typography>
                )}
              </Box>
              {cita.estado === 'atendida' && <Chip size="small" label="Atendida" color="success" />}
            </Stack>
          ))}
          {citas.length > 6 && (
            <Typography variant="caption" color="text.secondary">
              y {citas.length - 6} más…
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}

function AccesosRapidos({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Accesos rápidos
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        {children}
      </Stack>
    </Paper>
  );
}

function PanelRecepcionista({ resumen }: { resumen: ResumenRecepcionista }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TarjetaKpi etiqueta="Citas de hoy" valor={String(resumen.citasHoy.length)} icono={<EventIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TarjetaKpi
            etiqueta="Solicitudes del portal"
            valor={String(resumen.solicitudesPendientes)}
            icono={<HourglassTopIcon />}
            alerta={resumen.solicitudesPendientes > 0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TarjetaKpi
            etiqueta="Lista de espera"
            valor={String(resumen.listaEsperaPendiente)}
            icono={<PetsIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TarjetaKpi etiqueta="Cobrado hoy" valor={formatoMoneda(resumen.ingresosHoy)} icono={<ReceiptLongIcon />} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ListaCitasHoy citas={resumen.citasHoy} textoVacio="No hay citas programadas para hoy." />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <AccesosRapidos>
            <Button component={RouterLink} to="/agenda" variant="contained" startIcon={<AddIcon />}>
              Nueva cita
            </Button>
            <Button component={RouterLink} to="/facturacion" variant="outlined" startIcon={<ReceiptLongIcon />}>
              Emitir factura
            </Button>
            <Button component={RouterLink} to="/pacientes" variant="outlined" startIcon={<PetsIcon />}>
              Buscar paciente
            </Button>
          </AccesosRapidos>
        </Grid>
      </Grid>
    </Stack>
  );
}

function PanelVeterinario({ resumen }: { resumen: ResumenVeterinario }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TarjetaKpi etiqueta="Tus citas de hoy" valor={String(resumen.citasHoy.length)} icono={<EventIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TarjetaKpi
            etiqueta="Productos bajo mínimo"
            valor={String(resumen.alertaStockCount)}
            icono={<Inventory2Icon />}
            alerta={resumen.alertaStockCount > 0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TarjetaKpi
            etiqueta="Lista de espera"
            valor={String(resumen.listaEsperaPendiente)}
            icono={<PetsIcon />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ListaCitasHoy citas={resumen.citasHoy} textoVacio="No tienes citas asignadas para hoy." />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <AccesosRapidos>
            <Button component={RouterLink} to="/agenda" variant="contained" startIcon={<EventIcon />}>
              Ver agenda
            </Button>
            <Button component={RouterLink} to="/historial" variant="outlined" startIcon={<MedicalInformationIcon />}>
              Historial clínico
            </Button>
            <Button component={RouterLink} to="/inventario" variant="outlined" startIcon={<Inventory2Icon />}>
              Inventario
            </Button>
          </AccesosRapidos>
        </Grid>
      </Grid>
    </Stack>
  );
}

function PanelAdministrador({ resumen }: { resumen: ResumenAdministrador }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <TarjetaKpi etiqueta="Cobrado hoy" valor={formatoMoneda(resumen.ingresosHoy)} icono={<ReceiptLongIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <TarjetaKpi
            etiqueta="Facturas pendientes"
            valor={String(resumen.facturasPendientesCount)}
            icono={<AssessmentIcon />}
            alerta={resumen.facturasPendientesCount > 0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <TarjetaKpi
            etiqueta="Bajo mínimo"
            valor={String(resumen.alertaStockCount)}
            icono={<Inventory2Icon />}
            alerta={resumen.alertaStockCount > 0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <TarjetaKpi
            etiqueta="Lotes por vencer"
            valor={String(resumen.lotesPorVencerCount)}
            icono={<HourglassTopIcon />}
            alerta={resumen.lotesPorVencerCount > 0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <TarjetaKpi
            etiqueta="Órdenes de compra"
            valor={String(resumen.ordenesPendientesCount)}
            icono={<ShoppingCartIcon />}
          />
        </Grid>
      </Grid>

      <AccesosRapidos>
        <Button component={RouterLink} to="/inventario" variant="contained" startIcon={<Inventory2Icon />}>
          Inventario
        </Button>
        <Button component={RouterLink} to="/compras" variant="outlined" startIcon={<ShoppingCartIcon />}>
          Compras y Proveedores
        </Button>
        <Button component={RouterLink} to="/reportes" variant="outlined" startIcon={<AssessmentIcon />}>
          Reportes
        </Button>
        <Button component={RouterLink} to="/administracion" variant="outlined" startIcon={<AdminPanelSettingsIcon />}>
          Administración
        </Button>
      </AccesosRapidos>
    </Stack>
  );
}

// dayjs en espanol devuelve el nombre del dia en minuscula ("miercoles"); MUI
// textTransform:"capitalize" pondria en mayuscula CADA palabra ("Miercoles 26
// De Agosto", "de" incluido), asi que se corrige solo la primera letra a mano.
function fechaHoyCapitalizada(): string {
  const texto = dayjs().format('dddd D [de] MMMM');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function DashboardPage() {
  const { sesion } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumenRecepcion, setResumenRecepcion] = useState<ResumenRecepcionista | null>(null);
  const [resumenVeterinario, setResumenVeterinario] = useState<ResumenVeterinario | null>(null);
  const [resumenAdmin, setResumenAdmin] = useState<ResumenAdministrador | null>(null);

  const cargar = useCallback(async () => {
    if (!sesion) return;
    setCargando(true);
    setError(null);
    try {
      switch (sesion.rol.codigo) {
        case 'recepcionista':
          setResumenRecepcion(await obtenerResumenRecepcionista());
          break;
        case 'veterinario':
          setResumenVeterinario(await obtenerResumenVeterinario(sesion.usuario.id_usuario));
          break;
        case 'administrador':
          setResumenAdmin(await obtenerResumenAdministrador());
          break;
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [sesion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!sesion) return null;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Hola, {sesion.usuario.nombres}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {fechaHoyCapitalizada()}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {cargando && !resumenRecepcion && !resumenVeterinario && !resumenAdmin ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {sesion.rol.codigo === 'recepcionista' && resumenRecepcion && (
            <PanelRecepcionista resumen={resumenRecepcion} />
          )}
          {sesion.rol.codigo === 'veterinario' && resumenVeterinario && (
            <PanelVeterinario resumen={resumenVeterinario} />
          )}
          {sesion.rol.codigo === 'administrador' && resumenAdmin && (
            <PanelAdministrador resumen={resumenAdmin} />
          )}
        </>
      )}
    </Box>
  );
}
