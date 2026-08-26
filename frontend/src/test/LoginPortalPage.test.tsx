import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPortalPage } from '../portal/LoginPortalPage';
import { PortalAuthProvider } from '../portal/PortalAuthContext';

// Analoga a LoginPage.test.tsx (personal), agrupada aqui por el mismo pedido
// explicito del cliente. LoginPortalPage.tsx tiene la misma logica de
// validacion que LoginPage.tsx (comparten el mensaje "Correo o contraseña
// incorrectos." -- ver AuthContext.tsx y PortalAuthContext.tsx), asi que los
// casos de prueba son deliberadamente paralelos.
const { signInMock, getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: signInMock,
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

function renderLogin() {
  return render(
    <PortalAuthProvider>
      <LoginPortalPage />
    </PortalAuthProvider>,
  );
}

describe('LoginPortalPage (propietario)', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('correo o contraseña incorrectos muestra el mensaje de error y no deja la sesión iniciada', async () => {
    signInMock.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/^Correo/i), 'propietario@vetcare.local');
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'contraseñaIncorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith({ email: 'propietario@vetcare.local', password: 'contraseñaIncorrecta' });
  });

  it('enviar el formulario con campos vacíos no llama a signInWithPassword y muestra su propio aviso', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingresa tu correo y tu contraseña para continuar.')).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('correo o contraseña correctos no muestran ningún mensaje de error', async () => {
    signInMock.mockResolvedValueOnce({ error: null });
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/^Correo/i), 'propietario@vetcare.local');
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'VetCare#2026');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(signInMock).toHaveBeenCalled());
    expect(screen.queryByText('Correo o contraseña incorrectos.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ingresa tu correo y tu contraseña para continuar.')).not.toBeInTheDocument();
  });

  it('el enlace "¿Olvidaste tu contraseña?" no llama a signInWithPassword al abrir el diálogo', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.click(screen.getByText('¿Olvidaste tu contraseña?'));

    expect(await screen.findByRole('heading', { name: /olvidaste tu contraseña/i })).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
