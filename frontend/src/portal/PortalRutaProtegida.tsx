import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalAuth } from './PortalAuthContext';

interface Props {
  children: ReactNode;
}

// Analoga a auth/RutaProtegida.tsx, pero contra PortalAuthContext -- ver el
// comentario de PortalAuthProvider sobre por que son dos contextos separados.
export function PortalRutaProtegida({ children }: Props) {
  const { sesion, cargando } = usePortalAuth();

  if (cargando) return null;
  if (!sesion) return <Navigate to="/portal/ingresar" replace />;

  return <>{children}</>;
}
