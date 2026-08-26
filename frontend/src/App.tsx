import { Navigate, Route, Routes } from 'react-router-dom';
import { Backdrop, CircularProgress } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { AppLayout } from './layout/AppLayout';
import { PacientesPage } from './modules/pacientes/PacientesPage';
import { AgendaPage } from './modules/agenda/AgendaPage';
import { InventarioPage } from './modules/inventario/InventarioPage';
import { ComprasPage } from './modules/compras/ComprasPage';
import { HistorialPage } from './modules/historial/HistorialPage';
import { FacturacionPage } from './modules/facturacion/FacturacionPage';
import { ReportesPage } from './modules/facturacion/ReportesPage';
import { AdministracionPage } from './modules/administracion/AdministracionPage';

function PantallaCargando() {
  return (
    <Backdrop open sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 2 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}

function InicioPorRol() {
  const { sesion } = useAuth();
  if (!sesion) return null;

  switch (sesion.rol.codigo) {
    case 'recepcionista':
    case 'veterinario':
      return <Navigate to="/pacientes" replace />;
    case 'administrador':
      return <Navigate to="/inventario" replace />;
    default:
      return null;
  }
}

export default function App() {
  const { cargando, sesion } = useAuth();

  if (cargando) return <PantallaCargando />;

  return (
    <Routes>
      <Route path="/ingresar" element={sesion ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        element={
          <RutaProtegida>
            <AppLayout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<InicioPorRol />} />
        <Route
          path="/pacientes"
          element={
            <RutaProtegida rolesPermitidos={['recepcionista', 'veterinario']}>
              <PacientesPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/agenda"
          element={
            <RutaProtegida rolesPermitidos={['recepcionista', 'veterinario']}>
              <AgendaPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/inventario"
          element={
            <RutaProtegida rolesPermitidos={['veterinario', 'administrador']}>
              <InventarioPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/historial"
          element={
            <RutaProtegida rolesPermitidos={['veterinario']}>
              <HistorialPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/compras"
          element={
            <RutaProtegida rolesPermitidos={['administrador']}>
              <ComprasPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/facturacion"
          element={
            <RutaProtegida rolesPermitidos={['recepcionista', 'administrador']}>
              <FacturacionPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/reportes"
          element={
            <RutaProtegida rolesPermitidos={['administrador']}>
              <ReportesPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/administracion"
          element={
            <RutaProtegida rolesPermitidos={['administrador']}>
              <AdministracionPage />
            </RutaProtegida>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
