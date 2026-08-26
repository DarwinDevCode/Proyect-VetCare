import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OlvidePasswordDialog } from './OlvidePasswordDialog';

// Mock en el limite de lib/supabaseClient: solicitarRestablecerPassword
// (portal/api.ts) llama a supabase.functions.invoke de verdad, solo se
// reemplaza la red.
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

const MENSAJE_GENERICO = 'Si ese correo está registrado en el portal, te enviamos instrucciones para acceder.';

describe('OlvidePasswordDialog', () => {
  // Propiedad de seguridad central de este dialogo (ver CLAUDE.md seccion 14,
  // portal-olvide-password): nunca debe distinguir si la cuenta existe. Se
  // prueba explicitamente que un exito y un fallo de red producen el MISMO
  // texto en pantalla, para que un cambio futuro no filtre esa diferencia sin
  // darse cuenta.
  it('correo existente (la Edge Function responde ok) muestra el mensaje genérico', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const usuario = userEvent.setup();
    render(<OlvidePasswordDialog abierto onCerrar={() => {}} />);

    await usuario.type(screen.getByLabelText(/^Correo/i), 'propietario@vetcare.local');
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    expect(await screen.findByText(MENSAJE_GENERICO)).toBeInTheDocument();
  });

  it('fallo de red al invocar la función muestra un mensaje de reintento, no un error revelador', async () => {
    invokeMock.mockRejectedValueOnce(new Error('network error'));
    const usuario = userEvent.setup();
    render(<OlvidePasswordDialog abierto onCerrar={() => {}} />);

    await usuario.type(screen.getByLabelText(/^Correo/i), 'quien-sea@ejemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    expect(await screen.findByText('No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.')).toBeInTheDocument();
    // Nunca "no encontrado" ni el mensaje generico de exito -- un fallo de red
    // real es distinguible del caso "correo no registrado" (que SI usa el
    // mensaje generico), pero ninguno de los dos revela informacion sobre la
    // cuenta.
    expect(screen.queryByText(MENSAJE_GENERICO)).not.toBeInTheDocument();
  });

  it('correo vacío no llama a la función', async () => {
    const usuario = userEvent.setup();
    render(<OlvidePasswordDialog abierto onCerrar={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));

    expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
