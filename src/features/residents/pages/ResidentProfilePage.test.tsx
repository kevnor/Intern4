import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentProfilePage from './ResidentProfilePage';
import { deleteUser, getUser, reactivateUser, updateUser } from '../../../server/dao/userDAO';
import { getRegiLogsByUser } from '../../../server/dao/regiDAO';
import type { User } from '../../../shared/types/user';

const RESIDENT_ID = '22222222-2222-4222-8222-222222222222';
const mockUseAuth = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/userDAO', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  reactivateUser: vi.fn(),
  getRoles: vi.fn().mockResolvedValue([]),
  getSchools: vi.fn().mockResolvedValue([]),
  getStudies: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../server/dao/regiDAO', () => ({ getRegiLogsByUser: vi.fn() }));
vi.mock('../../../server/storage', () => ({
  createSignedImageUrl: vi.fn().mockResolvedValue(null),
}));

const profile: User = {
  name: 'Bjørn Beboersen',
  email: 'bjorn@example.test',
  phone: '40000002',
  birthDate: new Date('2003-09-30T12:00:00'),
  address: { street: 'Hjemveien 1', postalCode: '7000', city: 'Trondheim' },
  study: 'Datateknologi',
  studyPlace: 'NTNU',
  seniority: 3,
  roomNumber: 214,
  role: 'Halv/Halv',
  onLeave: false,
  isActive: true,
  createdAt: new Date('2025-08-01'),
};

const asRole = (role: string, id = 'viewer') =>
  mockUseAuth.mockReturnValue({ user: { id, name: 'Viewer', role } });

const renderProfile = (id = RESIDENT_ID) =>
  render(
    <MemoryRouter initialEntries={[`/beboere/${id}`]}>
      <Routes>
        <Route path="/beboere/:id" element={<ResidentProfilePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('ResidentProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUser).mockResolvedValue(profile);
    vi.mocked(getRegiLogsByUser).mockResolvedValue([]);
    vi.mocked(updateUser).mockResolvedValue(undefined);
  });

  it('shows residents the contact details but no admin section', async () => {
    asRole('Halv/Halv');
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Bjørn Beboersen' })).toBeInTheDocument();
    expect(screen.getByText('Rom 214')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ring Bjørn Beboersen' })).toHaveAttribute(
      'href',
      'tel:40000002'
    );
    expect(screen.getByText('3. Datateknologi (NTNU)')).toBeInTheDocument();
    expect(screen.queryByText('Administrasjon')).not.toBeInTheDocument();
    expect(screen.queryByText('Hjemveien 1, Trondheim')).not.toBeInTheDocument();
    expect(getRegiLogsByUser).not.toHaveBeenCalled();
  });

  it('gives room managers address, regi and actions', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    renderProfile();

    const admin = (await screen.findByRole('heading', { name: 'Administrasjon' })).closest(
      'section'
    ) as HTMLElement;
    expect(within(admin).getByText('Hjemadresse')).toBeInTheDocument();
    expect(within(admin).getByText('Hjemveien 1, Trondheim')).toBeInTheDocument();
    expect(within(admin).getByText('Regi dette semesteret')).toBeInTheDocument();

    await user.click(within(admin).getByRole('button', { name: 'Sett på permisjon' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Sette på permisjon?' })).getByRole('button', {
        name: 'Sett på permisjon',
      })
    );
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(RESIDENT_ID, { onLeave: true }));
    expect(await screen.findByText('Satt på permisjon.')).toBeInTheDocument();
  });

  it('deactivates after confirming', async () => {
    const user = userEvent.setup();
    asRole('Data');
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Deaktiver' }));
    const dialog = screen.getByRole('dialog', { name: 'Deaktivere beboer?' });
    expect(dialog).toHaveTextContent('kan reaktiveres senere');
    await user.click(within(dialog).getByRole('button', { name: 'Deaktiver' }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(RESIDENT_ID));
  });

  it('offers reactivation for former residents and never deactivation of admins', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getUser).mockResolvedValue({ ...profile, isActive: false });
    vi.mocked(reactivateUser).mockResolvedValue(undefined);
    renderProfile();

    expect(await screen.findByText('Tidligere beboer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deaktiver' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reaktiver' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reaktivere beboer?' })).getByRole('button', {
        name: 'Reaktiver',
      })
    );
    await waitFor(() => expect(reactivateUser).toHaveBeenCalledWith(RESIDENT_ID));
  });

  it('does not offer to deactivate an admin', async () => {
    asRole('Data');
    vi.mocked(getUser).mockResolvedValue({ ...profile, role: 'Admin' });
    renderProfile();

    expect(await screen.findByRole('button', { name: 'Rediger' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deaktiver' })).not.toBeInTheDocument();
  });

  it('shows a clear message for an unknown resident', async () => {
    asRole('Halv/Halv');
    vi.mocked(getUser).mockResolvedValue(undefined);
    renderProfile('missing');

    expect(await screen.findByText('Fant ikke beboeren')).toBeInTheDocument();
  });
});
