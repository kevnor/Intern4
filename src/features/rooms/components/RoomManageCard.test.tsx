import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomManageCard from './RoomManageCard';
import type { RoomAdmin } from '../hooks/useRoomAdmin';
import type { Room } from '../types';

const room: Room = {
  id: 'r150',
  number: 150,
  type: 'liten_parhybel',
  capacity: 2,
  occupants: [{ userId: 'b', userName: 'Bo', movedIn: new Date(2025, 7, 1) }],
};

const admin = (overrides: Partial<RoomAdmin> = {}): RoomAdmin =>
  ({
    residents: [
      { id: 'a', name: 'Anne', roomNumber: 0, isHusfar: false },
      { id: 'b', name: 'Bo', roomNumber: 150, isHusfar: false },
      { id: 'c', name: 'Cia', roomNumber: 101, isHusfar: false },
    ],
    busy: false,
    error: null,
    clearMessages: vi.fn(),
    assign: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as unknown as RoomAdmin;

describe('RoomManageCard', () => {
  it('moves someone out', async () => {
    const user = userEvent.setup();
    const roomAdmin = admin();
    render(<RoomManageCard room={room} admin={roomAdmin} />);

    await user.click(screen.getByRole('button', { name: 'Flytt ut Bo' }));

    expect(roomAdmin.assign).toHaveBeenCalledWith('b', null);
  });

  it('moves a resident in from another room or from none, but not someone already here', async () => {
    const user = userEvent.setup();
    const roomAdmin = admin();
    render(<RoomManageCard room={room} admin={roomAdmin} />);

    const select = screen.getByLabelText('Flytt inn beboer');
    const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels).toEqual(['Velg beboer', 'Anne (uten rom)', 'Cia (rom 101)']);

    await user.selectOptions(select, 'c');
    await user.click(screen.getByRole('button', { name: 'Flytt hit' }));

    expect(roomAdmin.assign).toHaveBeenCalledWith('c', 'r150');
  });

  it('does not let anyone move into a full room', () => {
    const full: Room = {
      ...room,
      occupants: [
        ...room.occupants,
        { userId: 'x', userName: 'Xena', movedIn: new Date(2025, 7, 1) },
      ],
    };
    render(<RoomManageCard room={full} admin={admin()} />);

    expect(screen.getByLabelText('Flytt inn beboer')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Flytt hit' })).toBeDisabled();
    expect(screen.getByText('Rommet er fullt. Flytt noen ut først.')).toBeInTheDocument();
  });
});
