import { Box, Typography } from '@mui/material';
import { ReporteIngresos } from './ReporteIngresos';

// RF-032, exclusivo de Administrador (matriz 3.8). Envoltorio delgado sobre
// ReporteIngresos.tsx (que ya tenia toda la logica) para que "Reportes" sea una
// ruta propia (1s) en vez de una pestana dentro de Facturacion -- el wireframe
// los separa porque los usa un rol distinto y en un momento distinto (Recepcion
// factura y cobra en el dia a dia; Administracion consulta el reporte
// periodicamente, no cada vez que entra al sistema).
export function ReportesPage() {
  return (
    <Box>
      <Box sx={{ mb: 3, displayPrint: 'none' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Reportes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ingresos consolidados por período.
        </Typography>
      </Box>
      <ReporteIngresos />
    </Box>
  );
}
