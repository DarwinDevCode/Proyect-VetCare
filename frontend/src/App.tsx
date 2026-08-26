import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Backdrop, CircularProgress } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { PacientesPage } from './modules/pacientes/PacientesPage';
import { AgendaPage } from './modules/agenda/AgendaPage';
import { InventarioPage } from './modules/inventario/InventarioPage';
import { ComprasPage } from './modules/compras/ComprasPage';
import { HistorialPage } from './modules/historial/HistorialPage';
import { FacturacionPage } from './modules/facturacion/FacturacionPage';
import { ReportesPage } from './modules/facturacion/ReportesPage';
import { AdministracionPage } from './modules/administracion/AdministracionPage';
import { PortalAuthProvider } from './portal/PortalAuthContext';
import { PortalApp } from './portal/PortalApp';

function PantallaCargando() {
  return (
    <Backdrop open sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 2 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}

// Fase 6: antes redirigia por rol a la pantalla de escritura principal de cada
// uno (Pacientes / Inventario); ahora todos los roles comparten un mismo
// destino, el Dashboard -- "/" sigue siendo solo el punto de entrada tras el
// login, nunca la ruta real de la pagina (ver modulos.ts: el item de nav
// "Dashboard" apunta a "/inicio", no a "/", por el problema de resaltado ya
// documentado en CLAUDE.md seccion 14, Fase 0).
function InicioPorRol() {
  return <Navigate to="/inicio" replace />;
}

export default function App() {
  const { cargando, sesion } = useAuth();
  const location = useLocation();

  // Bug real encontrado probando "Cambiar contraseña" del portal (CLAUDE.md
  // seccion 14): App() gateaba TODO el arbol de <Routes> -- incluida la rama
  // /portal/*, que no depende en nada de la sesion de personal -- detras del
  // "cargando" del AuthProvider de personal. El AuthProvider de personal y
  // PortalAuthProvider comparten el MISMO cliente de Supabase (mismo
  // auth.users, ver PortalAuthContext.tsx), asi que cualquier evento de auth
  // en una sesion de portal (updateUser(), un refresh de token) tambien
  // notificaba al listener de personal, que respondia con su propio
  // "cargando=true" -- eso desmontaba App() entero, incluido
  // PortalAuthProvider, reseteando su estado y cualquier dialogo de esa rama
  // que estuviera abierto (el mensaje de "contraseña actualizada" nunca
  // llegaba a verse pese a que el cambio si se aplicaba). PortalApp.tsx ya
  // tiene su propio loader con el cargando de PortalAuthContext -- el de
  // personal no debe aplicar ahi.
  if (cargando && !location.pathname.startsWith('/portal')) return <PantallaCargando />;

  return (
    <Routes>
      {/* Rama paralela y hermana, no anidada en RutaProtegida/AppLayout de personal
          (ver REDISENO-ORGANIC-PLAN.md, hallazgo de arquitectura #1): el
          AuthProvider de personal sigue montado por fuera para cualquier sesion de
          staff activa, pero /portal/* nunca lee su sesion/errorPerfil. */}
      <Route
        path="/portal/*"
        element={
          <PortalAuthProvider>
            <PortalApp />
          </PortalAuthProvider>
        }
      />

      <Route path="/ingresar" element={sesion ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        element={
          <RutaProtegida>
            <AppLayout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<InicioPorRol />} />
        <Route path="/inicio" element={<DashboardPage />} />
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
