import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import { useAuth } from './AuthContext';
import type { RolCodigo } from '../types/dominio';

interface Props {
  children: ReactNode;
  rolesPermitidos?: RolCodigo[];
}

// RF-002 / RNF-002: el rol tambien se verifica en el servidor (RLS); esto solo
// evita mostrar una pantalla a la que la API igualmente rechazaria el acceso.
export function RutaProtegida({ children, rolesPermitidos }: Props) {
  const { sesion, cargando } = useAuth();

  if (cargando) return null;
  if (!sesion) return <Navigate to="/ingresar" replace />;

  if (rolesPermitidos && !rolesPermitidos.includes(sesion.rol.codigo)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Tu rol no tiene acceso a esta sección.</Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
