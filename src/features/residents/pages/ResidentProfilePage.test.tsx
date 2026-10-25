import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentProfilePage from './ResidentProfilePage';
import { deleteUser, getUser, reactivateUser, updateUser } from '../../../server/dao/userDAO';
import { getRegiLogsByUser } from '../../../server/dao/regiDAO';
import {
  cancelMoveOut,
  getOffboardingPreview,
  getResidentEvents,
  planMoveOut,
} from '../../../server/dao/offboardingDAO';
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

  it('moves the resident out now, after showing what will happen', async () => {
    const user = userEvent.setup();
    asRole('Data');
    vi.mocked(getOffboardingPreview).mockResolvedValue({
      roomNumber: 214,
      futureShifts: 3,
      openSwaps: 1,
      waitingRomslipp: 0,
      openReports: 0,
      roleReset: null,
    });
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Flytt ut' }));
    const dialog = screen.getByRole('dialog', { name: 'Flytt ut Bjørn Beboersen?' });
    expect(await within(dialog).findByText('Rom 214 blir ledig.')).toBeInTheDocument();
    expect(within(dialog).getByText(/3 vakter frem i tid blir ledige/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Årsak/), 'Ferdig med studiet');
    await user.click(within(dialog).getByRole('button', { name: 'Flytt ut nå' }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(RESIDENT_ID, 'Ferdig med studiet'));
    expect(await screen.findByText('Bjørn Beboersen er flyttet ut.')).toBeInTheDocument();
  });

  it('plans a move-out for a date', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Flytt ut' }));
    const dialog = screen.getByRole('dialog', { name: 'Flytt ut Bjørn Beboersen?' });
    await user.click(within(dialog).getByRole('radio', { name: 'På en dato' }));
    const confirm = within(dialog).getByRole('button', { name: 'Planlegg utflytting' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Utflyttingsdato'), '2099-06-30');
    await user.click(confirm);

    await waitFor(() => expect(planMoveOut).toHaveBeenCalledWith(RESIDENT_ID, '2099-06-30', ''));
    expect(await screen.findByText(/planlagt til 30\.06\.2099/)).toBeInTheDocument();
  });

  it('shows a planned move-out and lets a manager cancel it', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getUser).mockResolvedValue({ ...profile, moveOutDate: '2099-06-30' });
    renderProfile();

    expect(await screen.findByText(/Flytter ut 30\.06\.2099/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avbryt utflytting' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Avbryte utflyttingen?' })).getByRole('button', {
        name: 'Avbryt utflytting',
      })
    );

    await waitFor(() => expect(cancelMoveOut).toHaveBeenCalledWith(RESIDENT_ID));
  });

  it('does not show a planned move-out to ordinary residents', async () => {
    asRole('Halv/Halv');
    vi.mocked(getUser).mockResolvedValue({ ...profile, moveOutDate: '2099-06-30' });
    renderProfile();

    await screen.findByRole('heading', { name: 'Bjørn Beboersen' });
    expect(screen.queryByText(/Flytter ut/)).not.toBeInTheDocument();
    expect(screen.queryByText('Historikk')).not.toBeInTheDocument();
  });

  it('shows the history to the people who manage residents, Regisjef included', async () => {
    asRole('Regisjef');
    vi.mocked(getResidentEvents).mockResolvedValue([
      {
        id: 'e1',
        kind: 'added',
        actorName: 'Rita Romsjef',
        reason: null,
        details: {},
        createdAt: new Date(2025, 7, 1, 12, 0),
      },
    ]);
    renderProfile();

    const history = (await screen.findByRole('heading', { name: 'Historikk' })).closest(
      'section'
    ) as HTMLElement;
    expect(await within(history).findByText('Lagt til')).toBeInTheDocument();
    expect(within(history).getByText(/Rita Romsjef/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flytt ut' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument();
  });

  it('offers reactivation for former residents and never a move-out for them', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getUser).mockResolvedValue({ ...profile, isActive: false });
    vi.mocked(reactivateUser).mockResolvedValue({});
    renderProfile();

    expect(await screen.findByText('Tidligere beboer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flytt ut' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reaktiver' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reaktivere beboer?' })).getByRole('button', {
        name: 'Reaktiver',
      })
    );
    await waitFor(() => expect(reactivateUser).toHaveBeenCalledWith(RESIDENT_ID));
  });

  it('shows the new temporary password when the login had to be made again', async () => {
    const user = userEvent.setup();
    asRole('Romsjef');
    vi.mocked(getUser).mockResolvedValue({ ...profile, isActive: false });
    vi.mocked(reactivateUser).mockResolvedValue({ initialPassword: 'Nytt1234Pass' });
    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Reaktiver' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reaktivere beboer?' })).getByRole('button', {
        name: 'Reaktiver',
      })
    );

    const dialog = await screen.findByRole('dialog', { name: 'Bruker reaktivert' });
    expect(within(dialog).getByLabelText('Midlertidig passord')).toHaveTextContent('Nytt1234Pass');
  });

  it('does not offer to move out an admin', async () => {
    asRole('Data');
    vi.mocked(getUser).mockResolvedValue({ ...profile, role: 'Admin' });
    renderProfile();

    expect(await screen.findByRole('button', { name: 'Rediger' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flytt ut' })).not.toBeInTheDocument();
  });

  it('shows a clear message for an unknown resident', async () => {
    asRole('Halv/Halv');
    vi.mocked(getUser).mockResolvedValue(undefined);
    renderProfile('missing');

    expect(await screen.findByText('Fant ikke beboeren')).toBeInTheDocument();
  });
});
