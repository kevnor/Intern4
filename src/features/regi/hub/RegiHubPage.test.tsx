import { Suspense } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { regiRoutes } from '../routes';
import { getRegiLogsByUser, getPendingRegiApprovals } from '../../../server/dao/regiDAO';
import { getTasks, submitTaskCompletion } from '../../../server/dao/tasksDAO';
import type { Task } from '../../../shared/types/regi/tasks';

const ME = '11111111-1111-4111-8111-111111111111';
const RESIDENT = '22222222-2222-4222-8222-222222222222';
const mockUseAuth = vi.fn();

vi.mock('../../../app/providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../server/dao/regiDAO', () => ({
  ALREADY_PROCESSED_MESSAGE: 'allerede behandlet',
  getRegiLogsByUser: vi.fn(),
  deletePendingRegiLog: vi.fn(),
  getPendingRegiApprovals: vi.fn(),
  approveRegiLog: vi.fn(),
  rejectRegiLog: vi.fn(),
  getApprovedRegiHoursByUserSince: vi.fn().mockResolvedValue({}),
  getAllRegiLogs: vi.fn().mockResolvedValue([]),
  getEarliestRegiDate: vi.fn().mockResolvedValue(null),
  addRegiLog: vi.fn(),
}));
vi.mock('../../../server/dao/tasksDAO', () => ({
  getTasks: vi.fn(),
  joinTask: vi.fn(),
  leaveTask: vi.fn(),
  submitTaskCompletion: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock('../../../server/dao/categoriesDAO', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getCategoryUsageCount: vi.fn().mockResolvedValue(0),
}));
vi.mock('../../../server/dao/userDAO', () => ({
  getActiveUsersWithRole: vi.fn().mockResolvedValue([
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Bjørn Beboer',
      email: 'b@x.no',
      role: 'Halv/Halv',
      isActive: true,
      onLeave: false,
    },
  ]),
  getUserNames: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../server/storage', () => ({
  uploadImages: vi.fn(),
  deleteImages: vi.fn(),
  createSignedImageUrls: vi.fn().mockResolvedValue([]),
  validateImageFile: vi.fn(),
}));

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;

// The hub is lazy-loaded, so wait for its tabs before asserting.
const renderAt = async (path: string) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <Routes>
          {regiRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
      <LocationProbe />
    </MemoryRouter>
  );
  await screen.findByRole('tablist', {}, { timeout: 5000 });
};

const asRole = (role: string) =>
  mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Test Person', role }, loading: false });

const joinedTask: Task = {
  id: 't1',
  title: 'Male gang',
  category: 'Regi',
  deadline: null,
  hourEstimate: 2,
  maxParticipants: 3,
  participants: [
    { assignmentId: 'a1', userId: ME, status: 'joined', joinedAt: '2026-09-01T10:00:00.000Z' },
  ],
  createdAt: '2026-09-01T10:00:00.000Z',
  isArchived: false,
};

const tabNames = () =>
  screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''));

describe('RegiHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRegiLogsByUser).mockResolvedValue([]);
    vi.mocked(getTasks).mockResolvedValue([]);
    vi.mocked(getPendingRegiApprovals).mockResolvedValue(
      ['p1', 'p2'].map((id) => ({
        id,
        userId: RESIDENT,
        userName: 'Bjørn Beboer',
        userEmail: 'b@x.no',
        title: `Innsending ${id}`,
        hours: 2,
        date: new Date('2026-10-01T12:00:00.000Z'),
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        sourceType: 'misc' as const,
        category: 'Regi',
      }))
    );
  });

  it('shows residents only their own tabs and keeps them out of manager tabs', async () => {
    asRole('Halv/Halv');
    await renderAt('/regi');

    expect(tabNames()).toEqual(['Oversikt', 'Oppgaver', 'Mine timer']);
    expect(getPendingRegiApprovals).not.toHaveBeenCalled();
  });

  it('redirects residents away from manager URLs', async () => {
    asRole('Halv/Halv');
    await renderAt('/regi/godkjenning');

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/regi$/);
    expect(screen.getByRole('tab', { name: 'Oversikt' })).toHaveAttribute('aria-selected', 'true');
  });

  it('gives regi managers the extra tabs with the pending count', async () => {
    asRole('Regisjef');
    await renderAt('/regi/godkjenning');

    expect(tabNames()).toEqual([
      'Oversikt',
      'Oppgaver',
      'Mine timer',
      'Godkjenning',
      'Status',
      'Logg',
    ]);
    const tab = screen.getByRole('tab', { name: /godkjenning/i });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(await within(tab).findByText('2')).toBeInTheDocument();
  });

  it('sends old Regisjef links to the new tabs', async () => {
    asRole('Regisjef');
    await renderAt('/regisjef/logg');

    expect(screen.getByTestId('location')).toHaveTextContent('/regi/logg');
    expect(screen.getByRole('tab', { name: 'Logg' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the register sheet from ?registrer=1', async () => {
    asRole('Halv/Halv');
    await renderAt('/regi?registrer=1');

    expect(await screen.findByRole('dialog', { name: 'Registrer timer' })).toBeInTheDocument();
  });

  it('opens Gi regi prefilled from a Status row', async () => {
    const user = userEvent.setup();
    asRole('Regisjef');
    await renderAt('/regi/status');

    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Gi timer til Bjørn Beboer' }));

    const sheet = screen.getByRole('dialog', { name: 'Gi regi' });
    await waitFor(() => expect(within(sheet).getByLabelText(/beboer/i)).toHaveValue(RESIDENT));
  });

  it('loads recent tasks first and older ones on request', async () => {
    const user = userEvent.setup();
    asRole('Halv/Halv');
    await renderAt('/regi/oppgaver');

    await waitFor(() =>
      expect(getTasks).toHaveBeenCalledWith({ since: expect.any(Date), userId: ME })
    );
    await user.click(screen.getByRole('radio', { name: 'Alle' }));
    await user.click(await screen.findByRole('button', { name: 'Vis eldre oppgaver' }));

    await waitFor(() => expect(getTasks).toHaveBeenLastCalledWith(undefined));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Vis eldre oppgaver' })).not.toBeInTheDocument()
    );
  });

  it('reloads hours after a task is sent in from the overview', async () => {
    const user = userEvent.setup();
    asRole('Halv/Halv');
    vi.mocked(getTasks).mockResolvedValue([joinedTask]);
    vi.mocked(submitTaskCompletion).mockResolvedValue(undefined);
    await renderAt('/regi');

    const card = (await screen.findAllByText('Male gang'))[0].closest('article') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Send inn' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Send inn til godkjenning?' })).getByRole(
        'button',
        { name: 'Send inn' }
      )
    );

    await waitFor(() => expect(submitTaskCompletion).toHaveBeenCalledWith('t1', ME));
    await waitFor(() => expect(getRegiLogsByUser).toHaveBeenCalledTimes(2));
  });
});
