import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminHubPage from './AdminHubPage';
import { getAllUsersWithRole } from '../../../server/dao/userDAO';

const mockUseAuth = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/userDAO', () => ({ getAllUsersWithRole: vi.fn() }));
vi.mock('../../regi/hooks/useSemesterHours', () => ({
  useSemesterHours: () => ({ totalHours: 40, loading: false, save: vi.fn() }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminHubPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u', name: 'Data', role: 'Data' }, loading: false });
    vi.mocked(getAllUsersWithRole).mockResolvedValue([
      {
        id: 'r1',
        name: 'Rita Romsjef',
        email: 'r@x.no',
        role: 'Romsjef',
        onLeave: false,
        isActive: true,
      },
      { id: 'd1', name: 'Dag Data', email: 'd@x.no', role: 'Data', onLeave: true, isActive: true },
    ]);
  });

  it('opens on the first tab when the address has no tab', async () => {
    renderAt('/admin');

    expect(await screen.findByRole('tabpanel', { name: 'Roller' })).toBeInTheDocument();
  });

  it('shows who holds each position role, and flags a role nobody holds', async () => {
    renderAt('/admin/roller');

    const panel = await screen.findByRole('tabpanel', { name: 'Roller' });
    expect(await within(panel).findByRole('link', { name: 'Rita Romsjef' })).toHaveAttribute(
      'href',
      '/beboere/r1'
    );
    expect(within(panel).getByText('(permisjon)')).toBeInTheDocument();
    // Vaktsjef, Regisjef, Admin, Daglig leder and Utvalgsmedlem have nobody in this data.
    expect(within(panel).getAllByText('Ingen')).toHaveLength(5);
  });

  it('shows the required hours under Semester', async () => {
    const user = userEvent.setup();
    renderAt('/admin/roller');

    await user.click(await screen.findByRole('tab', { name: 'Semester' }));

    const panel = screen.getByRole('tabpanel', { name: 'Semester' });
    expect(within(panel).getByLabelText('Timer per semester')).toHaveValue(40);
  });

  it('shows nothing to a role that should not be here, even if the route let it through', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u', name: 'Rita', role: 'Romsjef' },
      loading: false,
    });
    renderAt('/admin/roller');

    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(getAllUsersWithRole).not.toHaveBeenCalled();
  });

  it('says so when the roles cannot be loaded', async () => {
    vi.mocked(getAllUsersWithRole).mockRejectedValue(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderAt('/admin/roller');

    // A technical English message is replaced by one a person can use.
    expect(await screen.findByText('Kunne ikke laste rollene.')).toBeInTheDocument();
  });
});
