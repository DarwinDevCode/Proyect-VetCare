import type { ComponentType } from 'react';
import PetsIcon from '@mui/icons-material/Pets';
import EventIcon from '@mui/icons-material/Event';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import type { RolCodigo } from '../types/dominio';

// RI-002: el sistema presenta unicamente los modulos a los que el rol del
// usuario tiene acceso (SRS 3.8, Matriz de acceso por rol).
export interface DefinicionModulo {
  ruta: string;
  etiqueta: string;
  icono: ComponentType;
  roles: RolCodigo[];
  implementado: boolean;
}

export const MODULOS: DefinicionModulo[] = [
  {
    ruta: '/pacientes',
    etiqueta: 'Pacientes y Propietarios',
    icono: PetsIcon,
    roles: ['recepcionista', 'veterinario'],
    implementado: true,
  },
  {
    ruta: '/agenda',
    etiqueta: 'Agenda y Citas',
    icono: EventIcon,
    roles: ['recepcionista', 'veterinario'],
    implementado: true,
  },
  {
    ruta: '/historial',
    etiqueta: 'Historial Clínico',
    icono: MedicalInformationIcon,
    roles: ['veterinario'],
    implementado: false,
  },
  {
    ruta: '/inventario',
    etiqueta: 'Inventario y Medicamentos',
    icono: Inventory2Icon,
    roles: ['veterinario', 'administrador'],
    implementado: false,
  },
  {
    ruta: '/facturacion',
    etiqueta: 'Facturación y Reportes',
    icono: ReceiptLongIcon,
    roles: ['recepcionista', 'administrador'],
    implementado: false,
  },
];

export function modulosParaRol(rol: RolCodigo): DefinicionModulo[] {
  return MODULOS.filter((m) => m.roles.includes(rol));
}
