import { useState } from 'react';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import { UsuariosTab } from './UsuariosTab';
import { RolesTab } from './RolesTab';
import { CatalogosTab } from './CatalogosTab';
import { ParametrosTab } from './ParametrosTab';
import { AuditoriaTab } from './AuditoriaTab';

// Modulo de Administracion del sistema: cuentas de usuario, roles, catalogos
// de especie/raza, parametros de negocio y auditoria de cambios
// administrativos. Amplia deliberadamente el alcance cerrado del SRS (RES-05)
// por instruccion explicita del cliente del proyecto -- ver la nota de alcance
// en supabase/migrations/..._administracion.sql. Exclusivo de Administrador.
const PESTANAS = ['Usuarios', 'Roles', 'Catálogos', 'Parámetros', 'Auditoría'] as const;

export function AdministracionPage() {
  const [pestana, setPestana] = useState(0);

  return (
    <Box>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Administración del sistema
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cuentas de personal, roles, catálogos base, parámetros de negocio y bitácora de cambios.
        </Typography>
      </Stack>

      <Tabs value={pestana} onChange={(_e, valor: number) => setPestana(valor)} sx={{ mb: 3 }}>
        {PESTANAS.map((etiqueta) => (
          <Tab key={etiqueta} label={etiqueta} />
        ))}
      </Tabs>

      {pestana === 0 && <UsuariosTab />}
      {pestana === 1 && <RolesTab />}
      {pestana === 2 && <CatalogosTab />}
      {pestana === 3 && <ParametrosTab />}
      {pestana === 4 && <AuditoriaTab />}
    </Box>
  );
}
