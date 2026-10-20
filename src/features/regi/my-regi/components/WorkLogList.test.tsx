import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkLogList from './WorkLogList';
import { useWorkLogList } from '../hooks/useWorkLogList';
import type { RegiLogWithId } from '../../../../shared/types/regi';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const getRegiLogsByUser = vi.fn();
const deletePendingRegiLog = vi.fn();
const createSignedImageUrls = vi.fn();

vi.mock('../../../../server/dao/regiDAO', () => ({
  getRegiLogsByUser: (...args: unknown[]) => getRegiLogsByUser(...args),
  deletePendingRegiLog: (...args: unknown[]) => deletePendingRegiLog(...args),
}));

vi.mock('../../../../server/storage', () => ({
  createSignedImageUrls: (...args: unknown[]) => createSignedImageUrls(...args),
}));

const createLog = (overrides: Partial<RegiLogWithId> = {}): RegiLogWithId => ({
  id: '1',
  title: 'Rigge lyd',
  description: 'Setter opp anlegg',
  date: new Date('2026-04-11T09:00:00.000Z'),
  hours: 2.5,
  type: 'Dataarbeid',
  status: 'pending',
  createdAt: new Date('2026-04-11T11:00:00.000Z'),
  userId: USER_ID,
  sourceType: 'misc',
  reviewerComment: undefined,
  ...overrides,
});

// Wires the list to the real data hook, as WorkPage does.
const ConnectedList = () => {
  const { logs, loading, error, deletingId, deleteLog } = useWorkLogList(USER_ID);
  return (
    <WorkLogList
      logs={logs}
      loading={loading}
      error={error}
      deletingId={deletingId}
      onDelete={deleteLog}
    />
  );
};

// Both the phone cards and the desktop table are in the DOM; assert on the table.
const table = () => screen.getByRole('table');

describe('WorkLogList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the details modal when clicking a log row and shows reviewer comment', async () => {
    getRegiLogsByUser.mockResolvedValue([
      createLog({
        id: 'approved-log',
        status: 'approved',
        reviewerComment: 'Ser bra ut.',
        imagePaths: ['user/regi/one.png'],
      }),
    ]);
    createSignedImageUrls.mockResolvedValue(['https://example.com/one.png']);

    render(<ConnectedList />);

    await screen.findAllByText('Rigge lyd');
    await userEvent.click(within(table()).getByRole('row', { name: 'Vis Rigge lyd' }));

    const dialog = await screen.findByRole('dialog', { name: 'Rigge lyd' });
    expect(within(dialog).getByText('Kommentar fra regisjef')).toBeInTheDocument();
    expect(within(dialog).getByText('Ser bra ut.')).toBeInTheDocument();
    expect(within(dialog).getByText('Manuell registrering')).toBeInTheDocument();
    expect(await within(dialog).findByAltText('Opplastet bilde 1')).toHaveAttribute(
      'src',
      'https://example.com/one.png'
    );
    expect(within(dialog).queryByRole('button', { name: 'Slett' })).not.toBeInTheDocument();
  });

  it('shows delete only for pending manual logs', async () => {
    getRegiLogsByUser.mockResolvedValue([
      createLog({ id: 'pending-manual', title: 'Manuell pending' }),
      createLog({ id: 'pending-task', title: 'Oppgave pending', sourceType: 'task' }),
      createLog({ id: 'approved-manual', title: 'Manuell approved', status: 'approved' }),
    ]);

    render(<ConnectedList />);

    await screen.findAllByText('Manuell pending');
    const deleteButtons = within(table()).getAllByRole('button', { name: /slett/i });
    expect(deleteButtons).toHaveLength(1);
    expect(deleteButtons[0]).toHaveAccessibleName('Slett Manuell pending');
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    getRegiLogsByUser.mockResolvedValue([
      createLog({ id: 'a', title: 'Venter fortsatt' }),
      createLog({ id: 'b', title: 'Er godkjent', status: 'approved' }),
    ]);

    render(<ConnectedList />);

    await screen.findAllByText('Venter fortsatt');
    await user.click(screen.getByRole('radio', { name: 'Godkjent (1)' }));

    expect(within(table()).queryByText('Venter fortsatt')).not.toBeInTheDocument();
    expect(within(table()).getByText('Er godkjent')).toBeInTheDocument();
  });

  it('deletes a pending manual log after confirming, without opening the details', async () => {
    const user = userEvent.setup();
    getRegiLogsByUser.mockResolvedValue([createLog({ id: 'delete-me', title: 'Slettbar logg' })]);
    deletePendingRegiLog.mockResolvedValue(undefined);

    render(<ConnectedList />);

    await screen.findAllByText('Slettbar logg');
    await user.click(within(table()).getByRole('button', { name: 'Slett Slettbar logg' }));

    const confirm = screen.getByRole('dialog', { name: 'Slette registreringen?' });
    await user.click(within(confirm).getByRole('button', { name: 'Slett' }));

    await waitFor(() => {
      expect(deletePendingRegiLog).toHaveBeenCalledWith('delete-me', USER_ID);
    });
    await waitFor(() => {
      expect(screen.queryByText('Slettbar logg')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Slettbar logg' })).not.toBeInTheDocument();
  });

  it('keeps the log when deletion is cancelled', async () => {
    const user = userEvent.setup();
    getRegiLogsByUser.mockResolvedValue([createLog({ id: 'keep', title: 'Behold meg' })]);

    render(<ConnectedList />);

    await screen.findAllByText('Behold meg');
    await user.click(within(table()).getByRole('button', { name: 'Slett Behold meg' }));
    await user.click(screen.getByRole('button', { name: 'Avbryt' }));

    expect(deletePendingRegiLog).not.toHaveBeenCalled();
    expect(within(table()).getByText('Behold meg')).toBeInTheDocument();
  });

  it('groups entries by semester with the approved total', () => {
    render(
      <WorkLogList
        groupBySemester
        onDelete={vi.fn()}
        logs={[
          createLog({
            id: 'a',
            title: 'Høstjobb',
            status: 'approved',
            hours: 3,
            date: new Date(2026, 9, 1),
          }),
          createLog({
            id: 'b',
            title: 'Høstjobb 2',
            status: 'pending',
            hours: 1,
            date: new Date(2026, 8, 1),
          }),
          createLog({
            id: 'c',
            title: 'Vårjobb',
            status: 'approved',
            hours: 2,
            date: new Date(2026, 2, 1),
          }),
        ]}
      />
    );

    const autumn = screen.getByRole('region', { name: 'Høst 2026' });
    const spring = screen.getByRole('region', { name: 'Vår 2026' });
    expect(within(autumn).getByText('3 t godkjent')).toBeInTheDocument();
    expect(within(within(autumn).getByRole('table')).getAllByRole('row')).toHaveLength(3);
    expect(within(spring).getByText('2 t godkjent')).toBeInTheDocument();
    expect(autumn.compareDocumentPosition(spring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
