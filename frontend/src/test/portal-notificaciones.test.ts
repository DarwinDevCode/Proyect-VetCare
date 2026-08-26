import { describe, expect, it, vi } from 'vitest';
import { listarNotificacionesPortal } from '../portal/notificaciones';

const { listarMisCitasMock, listarMisFacturasMock } = vi.hoisted(() => ({
  listarMisCitasMock: vi.fn(),
  listarMisFacturasMock: vi.fn(),
}));
vi.mock('../portal/api', () => ({
  listarMisCitas: listarMisCitasMock,
  listarMisFacturas: listarMisFacturasMock,
}));

const CITA_SOLICITADA = {
  id_cita: 1,
  id_paciente: 1,
  fecha_hora_inicio: '2030-01-01T10:00:00-05:00',
  duracion_minutos: 30,
  motivo: 'Control',
  estado: 'solicitada',
  paciente: { nombre: 'Toby' },
  veterinario: null,
};
// Fecha muy en el futuro a proposito -- listarNotificacionesPortal compara
// contra dayjs() real (no hay reloj inyectable), asi que un literal lejano
// evita que la prueba se vuelva fragil con el paso del tiempo.
const CITA_CONFIRMADA_FUTURA = {
  id_cita: 2,
  id_paciente: 1,
  fecha_hora_inicio: '2030-01-05T09:00:00-05:00',
  duracion_minutos: 30,
  motivo: 'Vacunación',
  estado: 'programada',
  paciente: { nombre: 'Misha' },
  veterinario: { nombres: 'Carlos', apellidos: 'Veterinario' },
};
const CITA_ATENDIDA_PASADA = {
  id_cita: 3,
  id_paciente: 1,
  fecha_hora_inicio: '2020-01-01T09:00:00-05:00',
  duracion_minutos: 30,
  motivo: 'Consulta',
  estado: 'atendida',
  paciente: { nombre: 'Toby' },
  veterinario: { nombres: 'Carlos', apellidos: 'Veterinario' },
};
const CITA_CANCELADA = { ...CITA_CONFIRMADA_FUTURA, id_cita: 4, estado: 'cancelada' };

function factura(parcial: Partial<Record<string, unknown>>) {
  return {
    id_factura: 1,
    numero: 'F-00000001',
    id_propietario: 1,
    id_consulta: null,
    fecha_emision: '2026-08-20',
    id_usuario_emisor: 'r1',
    subtotal: 10,
    impuesto: 1.5,
    total: 11.5,
    total_pagado: 0,
    saldo_pendiente: 11.5,
    estado_cobro: 'pendiente',
    ...parcial,
  };
}

describe('listarNotificacionesPortal', () => {
  it('cita solicitada: avisa que espera confirmación, sin mencionar veterinario', async () => {
    listarMisCitasMock.mockResolvedValue([CITA_SOLICITADA]);
    listarMisFacturasMock.mockResolvedValue([]);

    const notificaciones = await listarNotificacionesPortal();

    expect(notificaciones).toEqual([
      { id: 'solicitud-1', texto: 'Solicitud enviada: Toby', detalle: 'Esperando confirmación de la clínica', ruta: '/portal/citas' },
    ]);
  });

  it('cita confirmada en el futuro: aparece con fecha y veterinario; una atendida en el pasado o cancelada, no', async () => {
    listarMisCitasMock.mockResolvedValue([CITA_CONFIRMADA_FUTURA, CITA_ATENDIDA_PASADA, CITA_CANCELADA]);
    listarMisFacturasMock.mockResolvedValue([]);

    const notificaciones = await listarNotificacionesPortal();

    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]).toMatchObject({ id: 'confirmada-2', texto: 'Cita confirmada: Misha', ruta: '/portal/citas' });
    expect(notificaciones[0].detalle).toContain('Carlos Veterinario');
  });

  it('factura pendiente o parcial aparece con su saldo; una pagada no', async () => {
    listarMisCitasMock.mockResolvedValue([]);
    listarMisFacturasMock.mockResolvedValue([
      factura({ id_factura: 10, numero: 'F-00000010', estado_cobro: 'pendiente', saldo_pendiente: 11.5 }),
      factura({ id_factura: 11, numero: 'F-00000011', estado_cobro: 'pagada', saldo_pendiente: 0 }),
    ]);

    const notificaciones = await listarNotificacionesPortal();

    expect(notificaciones).toEqual([
      { id: 'factura-10', texto: 'Factura pendiente: F-00000010', detalle: 'Saldo: $11,50', ruta: '/portal/facturas' },
    ]);
  });

  it('sin nada pendiente, la lista viene vacía', async () => {
    listarMisCitasMock.mockResolvedValue([]);
    listarMisFacturasMock.mockResolvedValue([]);
    expect(await listarNotificacionesPortal()).toEqual([]);
  });
});
