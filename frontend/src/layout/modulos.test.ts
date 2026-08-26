import { describe, expect, it } from 'vitest';
import { modulosParaRol } from './modulos';

// RI-002 / SRS 3.8: el sistema muestra unicamente los modulos a los que el
// rol tiene acceso. Esta matriz ya se verifico manualmente en cada fase
// (CLAUDE.md), pero nunca tuvo una prueba que impidiera que una fase futura
// la desalineara sin darse cuenta.
describe('modulosParaRol', () => {
  it('recepcionista ve Dashboard, Pacientes, Agenda y Facturación -- nada de clínica ni administración', () => {
    const rutas = modulosParaRol('recepcionista').map((m) => m.ruta);
    expect(rutas).toEqual(expect.arrayContaining(['/inicio', '/pacientes', '/agenda', '/facturacion']));
    expect(rutas).not.toContain('/historial');
    expect(rutas).not.toContain('/inventario');
    expect(rutas).not.toContain('/compras');
    expect(rutas).not.toContain('/administracion');
    expect(rutas).not.toContain('/reportes');
  });

  it('veterinario ve Pacientes, Agenda, Historial e Inventario -- nada de facturación ni compras', () => {
    const rutas = modulosParaRol('veterinario').map((m) => m.ruta);
    expect(rutas).toEqual(expect.arrayContaining(['/inicio', '/pacientes', '/agenda', '/historial', '/inventario']));
    expect(rutas).not.toContain('/facturacion');
    expect(rutas).not.toContain('/compras');
    expect(rutas).not.toContain('/administracion');
    expect(rutas).not.toContain('/reportes');
  });

  it('administrador ve Inventario, Compras, Facturación, Reportes y Administración -- nada de Pacientes/Agenda/Historial', () => {
    const rutas = modulosParaRol('administrador').map((m) => m.ruta);
    expect(rutas).toEqual(
      expect.arrayContaining(['/inicio', '/inventario', '/compras', '/facturacion', '/reportes', '/administracion']),
    );
    expect(rutas).not.toContain('/pacientes');
    expect(rutas).not.toContain('/agenda');
    expect(rutas).not.toContain('/historial');
  });

  it('los tres roles ven el Dashboard ("/inicio", nunca "/")', () => {
    for (const rol of ['recepcionista', 'veterinario', 'administrador'] as const) {
      const dashboard = modulosParaRol(rol).find((m) => m.etiqueta === 'Dashboard');
      expect(dashboard?.ruta).toBe('/inicio');
    }
  });
});
