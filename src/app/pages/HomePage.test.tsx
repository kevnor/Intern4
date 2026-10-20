import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';
import type { RegiLogWithId } from '../../shared/types/regi';
import type { Task } from '../../shared/types/regi/tasks';
import { getPendingRegiApprovals, getRegiLogsByUser } from '../../server/dao/regiDAO';
import { getTasks } from '../../server/dao/tasksDAO';
import { getCompletedShiftCounts } from '../../server/dao/vaktHoursDAO';

const ME = '11111111-1111-4111-8111-111111111111';
const mockUseAuth = vi.fn();

vi.mock('../providers/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../server/dao/regiDAO', () => ({
  getRegiLogsByUser: vi.fn(),
  getPendingRegiApprovals: vi.fn(),
}));
vi.mock('../../server/dao/tasksDAO', () => ({ getTasks: vi.fn() }));

const log = (overrides: Partial<RegiLogWithId>): RegiLogWithId => ({
  id: '1',
  userId: ME,
  title: 'Regi',
  hours: 4,
  date: new Date(),
  createdAt: new Date(),
  sourceType: 'misc',
  status: 'approved',
  type: 'Regi',
  ...overrides,
});

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

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRegiLogsByUser).mockResolvedValue([log({})]);
    vi.mocked(getTasks).mockResolvedValue([]);
    vi.mocked(getPendingRegiApprovals).mockResolvedValue([]);
  });

  it('greets the user and summarises this semester’s regi', async () => {
    mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Bjørn Beboersen', role: 'Halv/Halv' } });
    renderHome();

    expect(screen.getByRole('heading', { name: 'Hei, Bjørn!' })).toBeInTheDocument();
    expect(await screen.findByText('20 t igjen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /registrer timer/i })).toHaveAttribute(
      'href',
      '/regi?registrer=1'
    );
    expect(screen.getByText('Ingenting venter på deg akkurat nå.')).toBeInTheDocument();
    expect(getPendingRegiApprovals).not.toHaveBeenCalled();
  });

  it('lists what needs doing and links into the Regi hub', async () => {
    mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Bjørn', role: 'Halv/Halv' } });
    vi.mocked(getTasks).mockResolvedValue([joinedTask]);
    vi.mocked(getRegiLogsByUser).mockResolvedValue([
      log({ id: 'r', title: 'Snømåking', status: 'rejected', reviewerComment: 'Mangler bilde' }),
    ]);
    renderHome();

    expect(await screen.findByRole('link', { name: /send inn «male gang»/i })).toHaveAttribute(
      'href',
      '/regi'
    );
    expect(screen.getByRole('link', { name: /«snømåking» ble avslått/i })).toHaveAttribute(
      'href',
      '/regi/timer'
    );
    expect(screen.getByText('Mangler bilde')).toBeInTheDocument();
  });

  it('shows pending approvals to regi managers', async () => {
    mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Ada', role: 'Regisjef' } });
    vi.mocked(getPendingRegiApprovals).mockResolvedValue([{ id: '1' }, { id: '2' }] as never);
    renderHome();

    expect(await screen.findByRole('link', { name: /2 venter på godkjenning/i })).toHaveAttribute(
      'href',
      '/regi/godkjenning'
    );
  });

  it('shows finished vakt hours to residents with a vakt requirement', async () => {
    mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Vera Vakt', role: 'Full Vakt' } });
    vi.mocked(getCompletedShiftCounts).mockResolvedValueOnce({ [ME]: 2 });
    renderHome();

    expect(await screen.findByText('16 t')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Vakttimer av kravet' })).toHaveAttribute(
      'aria-valuemax',
      '48'
    );
    expect(screen.getByText('32 t igjen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se vaktene dine' })).toHaveAttribute(
      'href',
      '/vakt/mine'
    );
  });

  it('hides the vakt card from residents with no vakt', async () => {
    mockUseAuth.mockReturnValue({ user: { id: ME, name: 'Rune Regi', role: 'Full Regi' } });
    renderHome();

    await screen.findByText('44 t igjen');
    expect(screen.queryByRole('meter', { name: 'Vakttimer av kravet' })).not.toBeInTheDocument();
  });
});
