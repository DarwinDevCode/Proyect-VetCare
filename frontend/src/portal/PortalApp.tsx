import { Navigate, Route, Routes } from 'react-router-dom';
import { Backdrop, CircularProgress } from '@mui/material';
import { usePortalAuth } from './PortalAuthContext';
import { LoginPortalPage } from './LoginPortalPage';
import { PortalRutaProtegida } from './PortalRutaProtegida';
import { PortalLayout } from './PortalLayout';
import { MascotasPortalPage } from './MascotasPortalPage';
import { CitasPortalPage } from './CitasPortalPage';
import { FacturasPortalPage } from './FacturasPortalPage';

function PantallaCargando() {
  return (
    <Backdrop open sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 2 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}

// Rama de rutas completamente aparte de la de personal (App.tsx) -- ver el
// comentario de PortalAuthProvider (PortalAuthContext.tsx) sobre por que.
export function PortalApp() {
  const { cargando, sesion } = usePortalAuth();

  if (cargando) return <PantallaCargando />;

  return (
    <Routes>
      <Route path="ingresar" element={sesion ? <Navigate to="/portal/mascotas" replace /> : <LoginPortalPage />} />
      <Route
        element={
          <PortalRutaProtegida>
            <PortalLayout />
          </PortalRutaProtegida>
        }
      >
        <Route index element={<Navigate to="/portal/mascotas" replace />} />
        <Route path="mascotas" element={<MascotasPortalPage />} />
        <Route path="citas" element={<CitasPortalPage />} />
        <Route path="facturas" element={<FacturasPortalPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
