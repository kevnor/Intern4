import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyRoomTab from './MyRoomTab';
import { getUserRoomHistory } from '../../../server/dao/roomsDAO';
import {
  createRoomReport,
  getRoomReports,
  withdrawRoomReport,
} from '../../../server/dao/roomReportsDAO';
import userEvent from '@testing-library/user-event';
import type { Room } from '../types';

const movedIn = new Date(2025, 7, 1);

const rooms: Room[] = [
  {
    id: 'r1',
    number: 150,
    type: 'liten_parhybel',
    capacity: 2,
    occupants: [
      { userId: 'me', userName: 'Meg', movedIn },
      { userId: 'kari', userName: 'Kari Nordmann', movedIn },
    ],
  },
  { id: 'r2', number: 101, type: 'bottekott', capacity: 1, occupants: [] },
];

const renderTab = (userId: string, loading = false) =>
  render(
    <MemoryRouter>
      <MyRoomTab rooms={rooms} loading={loading} userId={userId} />
    </MemoryRouter>
  );

describe('MyRoomTab', () => {
  it('shows my room, its type, how long I have lived there and who I share it with', () => {
    renderTab('me');

    expect(screen.getByText('Rom 150')).toBeInTheDocument();
    expect(screen.getByText('Liten parhybel')).toBeInTheDocument();
    expect(screen.getByText('Du har bodd her siden 1.8.2025.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kari Nordmann' })).toHaveAttribute(
      'href',
      '/beboere/kari'
    );
    expect(screen.getByRole('link', { name: 'Se rommets historikk' })).toHaveAttribute(
      'href',
      '/rom/alle/150'
    );
  });

  it('says when a resident has no room', () => {
    renderTab('nobody');

    expect(screen.getByText('Du har ikke tildelt rom')).toBeInTheDocument();
  });

  it('lists the rooms I have lived in', async () => {
    vi.mocked(getUserRoomHistory).mockResolvedValueOnce([
      {
        id: 'o1',
        roomId: 'r1',
        roomNumber: 150,
        userId: 'me',
        userName: 'Meg',
        movedIn,
        movedOut: null,
      },
      {
        id: 'o0',
        roomId: 'r2',
        roomNumber: 101,
        userId: 'me',
        userName: 'Meg',
        movedIn: new Date(2024, 7, 1),
        movedOut: new Date(2025, 5, 1),
      },
    ]);
    renderTab('me');

    expect(await screen.findByRole('link', { name: 'Rom 101' })).toBeInTheDocument();
    expect(screen.getByText('1.8.2024 – 1.6.2025')).toBeInTheDocument();
  });

  it('shows reports for my room and lets me withdraw my own open report', async () => {
    const user = userEvent.setup();
    const report = (id: string, reportedBy: string, status: 'open' | 'resolved') => ({
      id,
      roomId: 'r1',
      roomNumber: 150,
      reportedBy,
      reporterName: reportedBy === 'me' ? 'Meg' : 'Kari Nordmann',
      title: `Melding ${id}`,
      description: null,
      status,
      workItemId: null,
      createdAt: new Date(2026, 9, 1),
      resolvedAt: null,
    });
    vi.mocked(getRoomReports).mockResolvedValueOnce([
      report('a', 'me', 'open'),
      report('b', 'kari', 'open'),
      report('c', 'me', 'resolved'),
    ]);
    renderTab('me');

    expect(await screen.findByText('Melding a')).toBeInTheDocument();
    // Only my own open report can be withdrawn.
    const buttons = screen.getAllByRole('button', { name: 'Trekk tilbake' });
    expect(buttons).toHaveLength(1);

    await user.click(buttons[0]);

    expect(withdrawRoomReport).toHaveBeenCalledWith('a');
  });

  it('lets me report a problem in my room', async () => {
    const user = userEvent.setup();
    renderTab('me');

    await user.click(screen.getByRole('button', { name: 'Meld problem' }));
    await user.type(screen.getByLabelText(/Hva er problemet/), 'Ødelagt lås');
    await user.click(screen.getByRole('button', { name: 'Send melding' }));

    expect(createRoomReport).toHaveBeenCalledWith({
      roomId: 'r1',
      reportedBy: 'me',
      title: 'Ødelagt lås',
      description: '',
    });
  });

  it('does not offer reporting to someone without a room', () => {
    renderTab('nobody');

    expect(screen.queryByRole('button', { name: 'Meld problem' })).not.toBeInTheDocument();
  });
});
