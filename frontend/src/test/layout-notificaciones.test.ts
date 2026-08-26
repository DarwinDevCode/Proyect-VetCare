import { describe, expect, it, vi } from 'vitest';
import { listarNotificaciones } from '../layout/notificaciones';

const { listarProductosMock, listarLotesPorVencerMock, listarSolicitudesPendientesMock, listarListaEsperaMock } =
  vi.hoisted(() => ({
    listarProductosMock: vi.fn(),
    listarLotesPorVencerMock: vi.fn(),
    listarSolicitudesPendientesMock: vi.fn(),
    listarListaEsperaMock: vi.fn(),
  }));

vi.mock('../modules/inventario/api', () => ({
  listarProductos: listarProductosMock,
  listarLotesPorVencer: listarLotesPorVencerMock,
}));
vi.mock('../modules/agenda/api', () => ({
  listarSolicitudesPendientes: listarSolicitudesPendientesMock,
  listarListaEspera: listarListaEsperaMock,
}));

const PRODUCTO_BAJO_MINIMO = {
  id_producto: 1,
  codigo: 'VAC-003',
  nombre: 'Vacuna Triple felina',
  tipo: 'vacuna',
  unidad_medida: 'dosis',
  nivel_minimo: 6,
  existencia_actual: 5,
  precio_unitario: 16.5,
  activo: true,
  intervalo_dias: 365,
};
const PRODUCTO_OK = { ...PRODUCTO_BAJO_MINIMO, id_producto: 2, existencia_actual: 40, nivel_minimo: 5 };
const PRODUCTO_INACTIVO_BAJO_MINIMO = { ...PRODUCTO_BAJO_MINIMO, id_producto: 3, activo: false };

const LOTE = { id_movimiento: 9, id_producto: 1, producto: 'Vacuna Triple felina', lote_codigo: 'TF-01', fecha_vencimiento: '2026-09-10', cantidad: 5, fecha_hora: '2026-08-01' };

const SOLICITUD = {
  id_cita: 10,
  id_paciente: 1,
  id_veterinario: null,
  fecha_hora_inicio: '2026-08-30T10:00:00-05:00',
  fecha_hora_fin: '2026-08-30T10:30:00-05:00',
  duracion_minutos: 30,
  motivo: 'Control',
  estado: 'solicitada',
  id_usuario_registro: null,
  fecha_registro: '2026-08-25',
  paciente: { id_paciente: 1, nombre: 'Toby', sexo: 'M', propietario: { nombres: 'María', apellidos: 'Chávez', telefono: '0991234567' } },
  veterinario: null,
};

const ESPERA_PENDIENTE = {
  id_lista_espera: 5,
  id_paciente: 1,
  id_veterinario: null,
  fecha_preferida: null,
  franja_preferida: null,
  motivo: 'Primera cita disponible',
  estado: 'pendiente',
  id_usuario_registro: 'r1',
  fecha_registro: '2026-08-25',
  paciente: { id_paciente: 1, nombre: 'Toby', sexo: 'M', propietario: { nombres: 'María', apellidos: 'Chávez', telefono: '0991234567' } },
  veterinario: null,
};
const ESPERA_ATENDIDA = { ...ESPERA_PENDIENTE, id_lista_espera: 6, estado: 'atendida' };

describe('listarNotificaciones', () => {
  it('administrador: incluye lotes por vencer y stock bajo, excluye productos inactivos y con stock ok', async () => {
    listarProductosMock.mockResolvedValue([PRODUCTO_BAJO_MINIMO, PRODUCTO_OK, PRODUCTO_INACTIVO_BAJO_MINIMO]);
    listarLotesPorVencerMock.mockResolvedValue([LOTE]);

    const notificaciones = await listarNotificaciones('administrador');

    expect(notificaciones).toHaveLength(2);
    expect(notificaciones.map((n) => n.id)).toEqual(expect.arrayContaining(['lote-9', 'stock-1']));
    expect(notificaciones.every((n) => n.ruta === '/inventario')).toBe(true);
  });

  it('administrador: sin alertas, la lista viene vacía', async () => {
    listarProductosMock.mockResolvedValue([PRODUCTO_OK]);
    listarLotesPorVencerMock.mockResolvedValue([]);
    expect(await listarNotificaciones('administrador')).toEqual([]);
  });

  it('recepcionista: incluye solicitudes de cita del portal y lista de espera pendiente, no la atendida', async () => {
    listarSolicitudesPendientesMock.mockResolvedValue([SOLICITUD]);
    listarListaEsperaMock.mockResolvedValue([ESPERA_PENDIENTE, ESPERA_ATENDIDA]);

    const notificaciones = await listarNotificaciones('recepcionista');

    expect(notificaciones.map((n) => n.id)).toEqual(['solicitud-10', 'espera-5']);
    expect(notificaciones.every((n) => n.ruta === '/agenda')).toBe(true);
  });

  it('veterinario: stock bajo + lista de espera pendiente, sin solicitudes del portal (esas son de Recepción)', async () => {
    listarProductosMock.mockResolvedValue([PRODUCTO_BAJO_MINIMO]);
    listarListaEsperaMock.mockResolvedValue([ESPERA_PENDIENTE]);

    const notificaciones = await listarNotificaciones('veterinario');

    expect(notificaciones.map((n) => n.id)).toEqual(['stock-1', 'espera-5']);
    expect(listarSolicitudesPendientesMock).not.toHaveBeenCalled();
  });

  it('rol desconocido devuelve lista vacía en vez de reventar', async () => {
    expect(await listarNotificaciones('rol-inexistente')).toEqual([]);
  });
});
