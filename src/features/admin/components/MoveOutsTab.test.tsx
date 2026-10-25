import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MoveOutsTab from './MoveOutsTab';
import { getResidentDirectoryUsers } from '../../../server/dao/userDAO';
import { cancelMoveOut, getRecentResidentEvents } from '../../../server/dao/offboardingDAO';
import type { ResidentDirectoryUser } from '../../../shared/types/user';
import type { ResidentFeedEvent } from '../../residents/offboarding';

vi.mock('../../../server/dao/userDAO', () => ({ getResidentDirectoryUsers: vi.fn() }));

const resident = (id: string, name: string, moveOutDate?: string) =>
  ({ id, name, isActive: true, onLeave: false, moveOutDate }) as ResidentDirectoryUser;

const event = (n: number, overrides: Partial<ResidentFeedEvent> = {}): ResidentFeedEvent => ({
  id: `e${n}`,
  userId: `u${n}`,
  residentName: `Beboer ${n}`,
  kind: 'added',
  actorName: 'Rita Romsjef',
  reason: null,
  details: {},
  createdAt: new Date(2026, 9, 10 + n, 12, 0),
  ...overrides,
});

const renderTab = () =>
  render(
    <MemoryRouter>
      <MoveOutsTab />
    </MemoryRouter>
  );

describe('MoveOutsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue([
      resident('b', 'Bo Senere', '2099-12-01'),
      resident('a', 'Ada Tidlig', '2099-01-15'),
      resident('c', 'Cia Blir'),
    ]);
    vi.mocked(getRecentResidentEvents).mockResolvedValue({ events: [], hasMore: false });
  });

  it('lists planned move-outs, soonest first, and nobody without a date', async () => {
    renderTab();

    const card = (await screen.findByRole('heading', { name: 'Planlagte utflyttinger' })).closest(
      'section'
    ) as HTMLElement;
    const links = await within(card).findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Ada Tidlig', 'Bo Senere']);
    expect(links[0]).toHaveAttribute('href', '/beboere/a');
    expect(within(card).getByText('15.01.2099')).toBeInTheDocument();
    expect(within(card).queryByText('Cia Blir')).not.toBeInTheDocument();
  });

  it('says so when nothing is planned', async () => {
    vi.mocked(getResidentDirectoryUsers).mockResolvedValue([resident('c', 'Cia Blir')]);
    renderTab();

    expect(await screen.findByText('Ingen utflyttinger er planlagt.')).toBeInTheDocument();
  });

  it('cancels a planned move-out after confirming, and reloads both lists', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click((await screen.findAllByRole('button', { name: 'Avbryt utflytting' }))[0]);
    const dialog = screen.getByRole('dialog', { name: 'Avbryte utflyttingen?' });
    expect(dialog).toHaveTextContent('Ada Tidlig blir boende');
    await user.click(within(dialog).getByRole('button', { name: 'Avbryt utflytting' }));

    await waitFor(() => expect(cancelMoveOut).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('Utflyttingen til Ada Tidlig er avbrutt.')).toBeInTheDocument();
    // Both lists were loaded again: the planned ones and the feed.
    expect(getResidentDirectoryUsers).toHaveBeenCalledTimes(2);
    expect(getRecentResidentEvents).toHaveBeenCalledTimes(2);
  });

  it('shows why when a cancel is refused, and keeps the list', async () => {
    const user = userEvent.setup();
    vi.mocked(cancelMoveOut).mockRejectedValue(new Error('Det er ingen planlagt utflytting'));
    renderTab();

    await user.click((await screen.findAllByRole('button', { name: 'Avbryt utflytting' }))[0]);
    await user.click(
      within(screen.getByRole('dialog', { name: 'Avbryte utflyttingen?' })).getByRole('button', {
        name: 'Avbryt utflytting',
      })
    );

    expect(await screen.findByText('Det er ingen planlagt utflytting')).toBeInTheDocument();
    expect(screen.getByText('Ada Tidlig')).toBeInTheDocument();
  });

  it('shows the feed with who did what, and loads more on request', async () => {
    const user = userEvent.setup();
    vi.mocked(getRecentResidentEvents)
      .mockResolvedValueOnce({
        events: [
          event(2, {
            kind: 'moved_out',
            reason: 'Ferdig med studiet',
            details: { shiftsReleased: 2, romslippSkipped: 0, roleReset: null },
          }),
          event(1),
        ],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        events: [event(0, { residentName: 'Eldre Beboer', actorName: null })],
        hasMore: false,
      });
    renderTab();

    const feed = (await screen.findByRole('heading', { name: 'Siste hendelser' })).closest(
      'section'
    ) as HTMLElement;
    expect(await within(feed).findByRole('link', { name: 'Beboer 2' })).toHaveAttribute(
      'href',
      '/beboere/u2'
    );
    expect(within(feed).getByText(/Flyttet ut/)).toBeInTheDocument();
    expect(within(feed).getByText('2 vakter frigjort')).toBeInTheDocument();
    expect(within(feed).getByText('Årsak: Ferdig med studiet')).toBeInTheDocument();

    await user.click(within(feed).getByRole('button', { name: 'Vis flere' }));

    expect(await within(feed).findByRole('link', { name: 'Eldre Beboer' })).toBeInTheDocument();
    expect(getRecentResidentEvents).toHaveBeenLastCalledWith(30, 2);
    expect(within(feed).queryByRole('button', { name: 'Vis flere' })).not.toBeInTheDocument();
  });

  it('says so when there are no events, and when the feed cannot be read', async () => {
    const { unmount } = renderTab();
    expect(await screen.findByText('Ingen hendelser er registrert ennå.')).toBeInTheDocument();
    unmount();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getRecentResidentEvents).mockRejectedValue(new Error('permission denied'));
    renderTab();
    expect(await screen.findByText('Du har ikke tilgang til å gjøre dette.')).toBeInTheDocument();
  });
});
