import { describe, expect, it, vi } from 'vitest';
import { obtenerResumenAdministrador, obtenerResumenRecepcionista, obtenerResumenVeterinario } from '../modules/dashboard/api';

const {
  listarCitasDelDiaMock,
  listarListaEsperaMock,
  listarSolicitudesPendientesMock,
  listarOrdenesCompraMock,
  listarFacturasMock,
  listarPagosDelPeriodoMock,
  listarLotesPorVencerMock,
  listarProductosMock,
} = vi.hoisted(() => ({
  listarCitasDelDiaMock: vi.fn(),
  listarListaEsperaMock: vi.fn(),
  listarSolicitudesPendientesMock: vi.fn(),
  listarOrdenesCompraMock: vi.fn(),
  listarFacturasMock: vi.fn(),
  listarPagosDelPeriodoMock: vi.fn(),
  listarLotesPorVencerMock: vi.fn(),
  listarProductosMock: vi.fn(),
}));

vi.mock('../modules/agenda/api', () => ({
  listarCitasDelDia: listarCitasDelDiaMock,
  listarListaEspera: listarListaEsperaMock,
  listarSolicitudesPendientes: listarSolicitudesPendientesMock,
}));
vi.mock('../modules/compras/api', () => ({ listarOrdenesCompra: listarOrdenesCompraMock }));
vi.mock('../modules/facturacion/api', () => ({
  listarFacturas: listarFacturasMock,
  listarPagosDelPeriodo: listarPagosDelPeriodoMock,
}));
vi.mock('../modules/inventario/api', () => ({
  listarLotesPorVencer: listarLotesPorVencerMock,
  listarProductos: listarProductosMock,
}));

function cita(parcial: Partial<Record<string, unknown>>) {
  return { id_cita: 1, id_veterinario: 'v1', estado: 'programada', ...parcial };
}
function producto(parcial: Partial<Record<string, unknown>>) {
  return { id_producto: 1, activo: true, existencia_actual: 10, nivel_minimo: 5, ...parcial };
}

describe('obtenerResumenRecepcionista', () => {
  it('excluye las citas canceladas del conteo de "citas de hoy" y suma los pagos del día', async () => {
    listarCitasDelDiaMock.mockResolvedValue([cita({ id_cita: 1, estado: 'programada' }), cita({ id_cita: 2, estado: 'cancelada' })]);
    listarSolicitudesPendientesMock.mockResolvedValue([{}, {}]);
    listarListaEsperaMock.mockResolvedValue([{ estado: 'pendiente' }, { estado: 'atendida' }]);
    listarPagosDelPeriodoMock.mockResolvedValue([{ monto: '10.50' }, { monto: '5.00' }]);

    const resumen = await obtenerResumenRecepcionista();

    expect(resumen.citasHoy).toHaveLength(1);
    expect(resumen.solicitudesPendientes).toBe(2);
    expect(resumen.listaEsperaPendiente).toBe(1);
    expect(resumen.ingresosHoy).toBe(15.5);
  });
});

describe('obtenerResumenVeterinario', () => {
  it('filtra las citas de hoy a las del propio veterinario -- resumen personal, no toda la agenda', async () => {
    listarCitasDelDiaMock.mockResolvedValue([
      cita({ id_cita: 1, id_veterinario: 'v1', estado: 'programada' }),
      cita({ id_cita: 2, id_veterinario: 'v2', estado: 'programada' }),
      cita({ id_cita: 3, id_veterinario: 'v1', estado: 'cancelada' }),
    ]);
    listarProductosMock.mockResolvedValue([producto({ existencia_actual: 2, nivel_minimo: 5 })]);
    listarListaEsperaMock.mockResolvedValue([{ estado: 'pendiente' }]);

    const resumen = await obtenerResumenVeterinario('v1');

    expect(resumen.citasHoy).toHaveLength(1);
    expect(resumen.citasHoy[0].id_cita).toBe(1);
    expect(resumen.alertaStockCount).toBe(1);
    expect(resumen.listaEsperaPendiente).toBe(1);
  });
});

describe('obtenerResumenAdministrador', () => {
  it('cuenta solo ordenes borrador/emitida como "pendientes" y facturas que no estan pagadas', async () => {
    listarPagosDelPeriodoMock.mockResolvedValue([{ monto: '20.00' }]);
    listarProductosMock.mockResolvedValue([
      producto({ id_producto: 1, existencia_actual: 1, nivel_minimo: 5, activo: true }),
      producto({ id_producto: 2, existencia_actual: 1, nivel_minimo: 5, activo: false }), // inactivo: no cuenta
    ]);
    listarLotesPorVencerMock.mockResolvedValue([{}, {}]);
    listarOrdenesCompraMock.mockResolvedValue([
      { id_orden_compra: 1, estado: 'borrador' },
      { id_orden_compra: 2, estado: 'emitida' },
      { id_orden_compra: 3, estado: 'recibida' },
      { id_orden_compra: 4, estado: 'cancelada' },
    ]);
    listarFacturasMock.mockResolvedValue([
      { id_factura: 1, estado_cobro: 'pagada' },
      { id_factura: 2, estado_cobro: 'pendiente' },
      { id_factura: 3, estado_cobro: 'parcial' },
    ]);

    const resumen = await obtenerResumenAdministrador();

    expect(resumen.ingresosHoy).toBe(20);
    expect(resumen.alertaStockCount).toBe(1);
    expect(resumen.lotesPorVencerCount).toBe(2);
    expect(resumen.ordenesPendientesCount).toBe(2);
    expect(resumen.facturasPendientesCount).toBe(2);
  });
});
