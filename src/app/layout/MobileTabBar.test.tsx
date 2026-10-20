import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileTabBar from './MobileTabBar';
import { ThemeProvider } from '../providers/ThemeProvider';

const mockUseAuth = vi.fn();
const mockLogOut = vi.fn();

vi.mock('../providers/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../server/dao/authentication', () => ({
  logOut: (...args: unknown[]) => mockLogOut(...args),
}));

const renderTabBar = (path = '/regi') =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <MobileTabBar />
      </MemoryRouter>
    </ThemeProvider>
  );

const resident = { id: '1', name: 'Vanlig Bruker', email: 'bruker@example.com', role: 'Halv/Halv' };

describe('MobileTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when logged out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderTabBar();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('has Hjem, Regi, Beboere and Meny, with Regi current on every regi tab', () => {
    mockUseAuth.mockReturnValue({ user: resident });
    renderTabBar('/regi/timer');

    const tabBar = screen.getByRole('navigation', { name: 'Hovedmeny' });
    expect(within(tabBar).getByRole('link', { name: 'Regi' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(tabBar).getByRole('link', { name: 'Beboere' })).toHaveAttribute(
      'href',
      '/beboere'
    );
    expect(within(tabBar).getByRole('link', { name: 'Hjem' })).not.toHaveAttribute('aria-current');
    expect(within(tabBar).getByRole('button', { name: 'Meny' })).toBeInTheDocument();
  });

  it('marks Hjem as current only on the home page', () => {
    mockUseAuth.mockReturnValue({ user: resident });
    renderTabBar('/');

    const tabBar = screen.getByRole('navigation', { name: 'Hovedmeny' });
    expect(within(tabBar).getByRole('link', { name: 'Hjem' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(tabBar).getByRole('link', { name: 'Regi' })).not.toHaveAttribute('aria-current');
  });

  it('opens a role-filtered menu that closes on navigation', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: resident });
    renderTabBar('/regi');

    await user.click(screen.getByRole('button', { name: 'Meny' }));

    const menu = screen.getByRole('dialog', { name: 'Meny' });
    expect(within(menu).getByRole('link', { name: 'Regi' })).toHaveAttribute('href', '/regi');
    expect(within(menu).getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profil');
    expect(within(menu).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('link', { name: 'Administrer brukere' })
    ).not.toBeInTheDocument();

    await user.click(within(menu).getByRole('link', { name: 'Profil' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('logs out from the menu', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '2', name: 'Regi Sjef', email: 'regi@example.com', role: 'Regisjef' },
    });
    mockLogOut.mockResolvedValue(undefined);
    renderTabBar('/regi/oppgaver');

    await user.click(screen.getByRole('button', { name: 'Meny' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Meny' })).getByRole('button', { name: 'Logg ut' })
    );
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });
});
