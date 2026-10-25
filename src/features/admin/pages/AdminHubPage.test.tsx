import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminHubPage from './AdminHubPage';
import { getAllUsersWithRole, getResidentDirectoryUsers } from '../../../server/dao/userDAO';
import { getPendingRegiApprovals } from '../../../server/dao/regiDAO';
import { getRooms } from '../../../server/dao/roomsDAO';
import { getRoomReports } from '../../../server/dao/roomReportsDAO';
import type { ResidentDirectoryUser } from '../../../shared/types/user';

const mockUseAuth = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/userDAO', () => ({
  getAllUsersWithRole: vi.fn(),
  getResidentDirectoryUsers: vi.fn(),
}));
vi.mock('../../../server/dao/regiDAO', () => ({ getPendingRegiApprovals: vi.fn() }));
vi.mock('../../regi/hooks/useSemesterHours', () => ({
  useSemesterHours: () => ({ totalHours: 40, loading: false, save: vi.fn() }),
}));

const resident = (id: string, overrides: Partial<ResidentDirectoryUser> = {}) =>
  ({
    id,
    name: id,
    email: '',
    phone: '',
    birthDate: null,
    study: '',
    studyPlace: '',
    seniority: 0,
    roomNumber: 101,
    createdAt: null,
    onLeave: false,
    isActive: true,
    address: { street: '', postalCode: '', city: '' },
    ...overrides,
  }) as ResidentDirectoryUser;

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
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue([
      resident('a'),
      resident('b', { onLeave: true }),
      resident('c', { roomNumber: 0 }),
    ]);
    vi.mocked(getRooms).mockResolvedValue([
      { id: 'r1', number: 101, type: null, capacity: 2, occupants: [] },
    ]);
    vi.mocked(getRoomReports).mockResolvedValue([]);
    vi.mocked(getPendingRegiApprovals).mockResolvedValue([]);
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

  it('opens on Oversikt when the address has no tab', async () => {
    renderAt('/admin');

    expect(await screen.findByRole('tabpanel', { name: 'Oversikt' })).toBeInTheDocument();
  });

  it('shows what needs a look, each number linking to where it is dealt with', async () => {
    vi.mocked(getPendingRegiApprovals).mockResolvedValue([{}, {}, {}] as never);
    renderAt('/admin/oversikt');

    const panel = await screen.findByRole('tabpanel', { name: 'Oversikt' });
    const tile = async (label: string) =>
      (await within(panel).findByText(label)).closest('a') as HTMLElement;

    const active = await tile('Aktive beboere');
    expect(within(active).getByText('3')).toBeInTheDocument();
    expect(active).toHaveAttribute('href', '/beboere');
    expect(within(await tile('På permisjon')).getByText('1')).toBeInTheDocument();
    expect(within(await tile('Uten rom')).getByText('1')).toBeInTheDocument();
    expect(within(await tile('Ledige plasser')).getByText('2')).toBeInTheDocument();
    const approvals = await tile('Regi til godkjenning');
    expect(within(approvals).getByText('3')).toBeInTheDocument();
    expect(approvals).toHaveAttribute('href', '/regi/godkjenning');
    expect(await tile('Planlagte utflyttinger')).toHaveAttribute('href', '/admin/utflyttinger');
    expect(await tile('Åpne romrapporter')).toHaveAttribute('href', '/rom/meldinger');
  });

  it('shows a dash for a number that cannot be read, and still shows the rest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getPendingRegiApprovals).mockRejectedValue(new Error('permission denied'));
    renderAt('/admin/oversikt');

    const panel = await screen.findByRole('tabpanel', { name: 'Oversikt' });
    const approvals = (await within(panel).findByText('Regi til godkjenning')).closest(
      'a'
    ) as HTMLElement;
    expect(within(approvals).getByText('–')).toBeInTheDocument();
    expect(within(approvals).getByText('Kunne ikke leses')).toBeInTheDocument();
    const active = (await within(panel).findByText('Aktive beboere')).closest('a') as HTMLElement;
    expect(within(active).getByText('3')).toBeInTheDocument();
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
    renderAt('/admin/oversikt');

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
