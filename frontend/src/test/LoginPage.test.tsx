import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../auth/LoginPage';
import { AuthProvider } from '../auth/AuthContext';

// Mock en el limite de lib/supabaseClient (no mas arriba): se prueba
// LoginPage + AuthProvider reales, no un componente aislado.
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
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

describe('LoginPage (personal)', () => {
  beforeEach(() => {
    // Sesion inicial vacia: AuthProvider consulta esto al montar sin importar
    // el escenario que pruebe cada test.
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  // Caso pedido explicitamente por el cliente como ejemplo de lo que faltaba
  // cubrir: ingresar con datos incorrectos.
  it('correo o contraseña incorrectos muestra el mensaje de error y no deja la sesión iniciada', async () => {
    signInMock.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/^Correo/i), 'recepcion@vetcare.local');
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'contraseñaIncorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith({ email: 'recepcion@vetcare.local', password: 'contraseñaIncorrecta' });
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

    await usuario.type(screen.getByLabelText(/^Correo/i), 'recepcion@vetcare.local');
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'VetCare#2026');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(signInMock).toHaveBeenCalled());
    expect(screen.queryByText('Correo o contraseña incorrectos.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ingresa tu correo y tu contraseña para continuar.')).not.toBeInTheDocument();
  });

  it('un segundo intento tras un error incorrecto limpia el mensaje anterior mientras se reenvía', async () => {
    signInMock.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    signInMock.mockResolvedValueOnce({ error: null });
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/^Correo/i), 'recepcion@vetcare.local');
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'primeraIncorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();

    await usuario.clear(screen.getByLabelText(/^Contraseña/i));
    await usuario.type(screen.getByLabelText(/^Contraseña/i), 'VetCare#2026');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.queryByText('Correo o contraseña incorrectos.')).not.toBeInTheDocument());
  });
});
