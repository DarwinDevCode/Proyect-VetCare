import { Navigate, Route, Routes } from 'react-router-dom';
import { Backdrop, CircularProgress } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { AppLayout } from './layout/AppLayout';
import { PacientesPage } from './modules/pacientes/PacientesPage';
import { HistorialPage } from './modules/historial/HistorialPage';

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
          path="/historial"
          element={
            <RutaProtegida rolesPermitidos={['veterinario']}>
              <HistorialPage />
            </RutaProtegida>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
