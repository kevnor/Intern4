import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';
import { logIn, signInWithMicrosoft } from '../../../server/dao/authentication';

const mockUseAuth = vi.fn();
const clearError = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/authentication', () => ({
  logIn: vi.fn(),
  signInWithMicrosoft: vi.fn(),
}));

const renderForm = () =>
  render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  );

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/login');
    mockUseAuth.mockReturnValue({ user: null, error: null, clearError });
  });

  it('labels its fields and logs in with Enter', async () => {
    const user = userEvent.setup();
    vi.mocked(logIn).mockResolvedValue({ success: true } as never);
    renderForm();

    await user.type(screen.getByLabelText('E-post'), 'ola@example.test');
    await user.type(screen.getByLabelText('Passord'), 'hemmelig{Enter}');

    await waitFor(() => expect(logIn).toHaveBeenCalledWith('ola@example.test', 'hemmelig'));
    expect(logIn).toHaveBeenCalledTimes(1);
  });

  it('can reveal the password', async () => {
    const user = userEvent.setup();
    renderForm();

    const password = screen.getByLabelText('Passord');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Vis passord' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Skjul passord' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows the login error', async () => {
    const user = userEvent.setup();
    vi.mocked(logIn).mockResolvedValue({ success: false, error: 'Feil e-post eller passord' });
    renderForm();

    await user.type(screen.getByLabelText('E-post'), 'ola@example.test');
    await user.type(screen.getByLabelText('Passord'), 'feil');
    await user.click(screen.getByRole('button', { name: 'Logg inn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Feil e-post eller passord');
  });

  it('offers Microsoft sign-in first and starts it', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithMicrosoft).mockResolvedValue({ success: true });
    renderForm();

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons[0]).toBe('Logg inn med Microsoft');

    await user.click(screen.getByRole('button', { name: 'Logg inn med Microsoft' }));

    expect(signInWithMicrosoft).toHaveBeenCalledTimes(1);
    expect(logIn).not.toHaveBeenCalled();
  });

  it('shows why the Microsoft sign-in could not start, and lets the user try again', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithMicrosoft).mockResolvedValue({
      success: false,
      error: 'Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.',
    });
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Logg inn med Microsoft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingen kontakt med serveren');
    expect(screen.getByRole('button', { name: 'Logg inn med Microsoft' })).toBeEnabled();
  });

  it('shows the reason when Microsoft sends the user back with an error, and cleans the address', async () => {
    window.history.replaceState(
      null,
      '',
      `/login?error=server_error&error_description=${encodeURIComponent('Du er ikke registrert som beboer. Kontakt romsjef eller Data.')}`
    );
    renderForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Du er ikke registrert som beboer');
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('shows why the app signed the user out again (no active profile)', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      error: 'Kontoen er deaktivert. Kontakt romsjef eller Data.',
      clearError,
    });
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('Kontoen er deaktivert');
  });

  it('clears an old sign-in error when the user tries again', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithMicrosoft).mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue({ user: null, error: 'Kontoen er deaktivert.', clearError });
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Logg inn med Microsoft' }));

    expect(clearError).toHaveBeenCalled();
  });

  it('hides the email form and "glemt passord" when local sign-in is switched off', () => {
    vi.stubEnv('VITE_LOCAL_LOGIN_ENABLED', 'false');
    renderForm();

    expect(screen.getByRole('button', { name: 'Logg inn med Microsoft' })).toBeInTheDocument();
    expect(screen.queryByLabelText('E-post')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Passord')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Glemt passord?' })).not.toBeInTheDocument();
  });

  it('keeps both ways in while local sign-in is on', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Logg inn med Microsoft' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-post')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Glemt passord?' })).toBeInTheDocument();
  });
});
