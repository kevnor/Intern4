import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from './Navbar';
import { ThemeProvider } from '../providers/ThemeProvider';

const mockUseAuth = vi.fn();
const mockLogOut = vi.fn();

vi.mock('../providers/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../server/dao/authentication', () => ({
  logOut: (...args: unknown[]) => mockLogOut(...args),
}));

const renderNavbar = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the login link when there is no authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderNavbar();

    expect(screen.getByRole('link', { name: 'Logg inn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle menu/i })).not.toBeInTheDocument();
  });

  it('shows role-based navigation for data users and logs out from the user menu', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Data Bruker',
        email: 'data@example.com',
        role: 'Data',
      },
    });
    mockLogOut.mockResolvedValue(undefined);

    renderNavbar();

    expect(screen.getByRole('link', { name: 'Hjem' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Beboere' })).toHaveAttribute('href', '/beboere');
    expect(screen.getByRole('link', { name: 'Regi' })).toHaveAttribute('href', '/regi');
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /data bruker/i }));
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profil');
    expect(screen.getByRole('radiogroup', { name: 'Utseende' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Logg ut' }));

    await waitFor(() => {
      expect(mockLogOut).toHaveBeenCalledTimes(1);
    });
  });

  it('hides admin navigation for non-data users', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Vanlig Bruker',
        email: 'bruker@example.com',
        role: 'Halv/Halv',
      },
    });

    renderNavbar();

    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beboere' })).toHaveAttribute('href', '/beboere');
    expect(screen.getByRole('link', { name: 'Regi' })).toHaveAttribute('href', '/regi');
  });
});
