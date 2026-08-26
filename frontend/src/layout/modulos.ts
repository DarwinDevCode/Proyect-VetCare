import type { ComponentType } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PetsIcon from '@mui/icons-material/Pets';
import EventIcon from '@mui/icons-material/Event';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
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
    // Fase 6: apunta a "/inicio", no a "/" -- "/" solo redirige aqui (InicioPorRol
    // en App.tsx), nunca es la ruta activa de una pagina. Si "ruta" fuera "/",
    // location.pathname.startsWith(modulo.ruta) coincidiria con *cualquier* ruta
    // de la app y este item apareceria siempre seleccionado (ver CLAUDE.md
    // seccion 14, Fase 0, donde por esto mismo se pospuso agregar esta entrada).
    ruta: '/inicio',
    etiqueta: 'Dashboard',
    icono: DashboardIcon,
    roles: ['recepcionista', 'veterinario', 'administrador'],
    implementado: true,
  },
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
    implementado: true,
  },
  {
    ruta: '/inventario',
    etiqueta: 'Inventario y Medicamentos',
    icono: Inventory2Icon,
    roles: ['veterinario', 'administrador'],
    implementado: true,
  },
  {
    ruta: '/compras',
    etiqueta: 'Compras y Proveedores',
    icono: ShoppingCartIcon,
    roles: ['administrador'],
    implementado: true,
  },
  {
    ruta: '/facturacion',
    etiqueta: 'Facturación',
    icono: ReceiptLongIcon,
    roles: ['recepcionista', 'administrador'],
    implementado: true,
  },
  {
    ruta: '/reportes',
    etiqueta: 'Reportes',
    icono: AssessmentIcon,
    roles: ['administrador'],
    implementado: true,
  },
  {
    ruta: '/administracion',
    etiqueta: 'Administración',
    icono: AdminPanelSettingsIcon,
    roles: ['administrador'],
    implementado: true,
  },
];

export function modulosParaRol(rol: RolCodigo): DefinicionModulo[] {
  return MODULOS.filter((m) => m.roles.includes(rol));
}
