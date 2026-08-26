import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CambiarPasswordDialog } from '../portal/CambiarPasswordDialog';

// Mock en el limite de lib/supabaseClient (no mas arriba): se prueba el
// dialogo con su logica real hasta la frontera de red, no un componente
// aislado de todo. vi.hoisted es necesario porque vi.mock se eleva por
// encima de los imports; sin el, referenciar updateUserMock adentro del
// factory fallaria.
const { updateUserMock } = vi.hoisted(() => ({ updateUserMock: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { updateUser: updateUserMock } },
}));

describe('CambiarPasswordDialog', () => {
  it('contraseña de menos de 8 caracteres muestra su error y no llama a updateUser', async () => {
    const usuario = userEvent.setup();
    render(<CambiarPasswordDialog abierto onCerrar={() => {}} />);

    await usuario.type(screen.getByLabelText(/^Contraseña nueva/i), 'corta1');
    await usuario.type(screen.getByLabelText(/^Confirmar contraseña nueva/i), 'corta1');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('confirmación distinta a la contraseña nueva muestra su error y no llama a updateUser', async () => {
    const usuario = userEvent.setup();
    render(<CambiarPasswordDialog abierto onCerrar={() => {}} />);

    await usuario.type(screen.getByLabelText(/^Contraseña nueva/i), 'ContraseñaLarga123');
    await usuario.type(screen.getByLabelText(/^Confirmar contraseña nueva/i), 'OtraDistinta456');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('No coincide con la contraseña nueva.')).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('envío exitoso muestra el mensaje de éxito y no se cierra solo', async () => {
    updateUserMock.mockResolvedValueOnce({ error: null });
    const onCerrar = vi.fn();
    const usuario = userEvent.setup();
    render(<CambiarPasswordDialog abierto onCerrar={onCerrar} />);

    await usuario.type(screen.getByLabelText(/^Contraseña nueva/i), 'ContraseñaLarga123');
    await usuario.type(screen.getByLabelText(/^Confirmar contraseña nueva/i), 'ContraseñaLarga123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Tu contraseña se actualizó correctamente.')).toBeInTheDocument();
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'ContraseñaLarga123' });
    // El bug real documentado en CLAUDE.md seccion 14 era justamente que el
    // dialogo se cerraba solo antes de que el usuario viera este mensaje.
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('un error de Supabase Auth se muestra tal cual, sin cerrar el diálogo', async () => {
    // AuthError (la clase real de @supabase/supabase-js) extiende Error --
    // el mock usa una instancia real, no un objeto plano, para que
    // "error instanceof Error" en el componente se comporte igual que en
    // producción.
    updateUserMock.mockResolvedValueOnce({ error: new Error('New password should be different from the old password.') });
    const usuario = userEvent.setup();
    render(<CambiarPasswordDialog abierto onCerrar={() => {}} />);

    await usuario.type(screen.getByLabelText(/^Contraseña nueva/i), 'ContraseñaLarga123');
    await usuario.type(screen.getByLabelText(/^Confirmar contraseña nueva/i), 'ContraseñaLarga123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('New password should be different from the old password.')).toBeInTheDocument();
  });
});
