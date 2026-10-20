import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';
import { logIn } from '../../../server/dao/authentication';

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../server/dao/authentication', () => ({ logIn: vi.fn() }));

const renderForm = () =>
  render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  );

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
