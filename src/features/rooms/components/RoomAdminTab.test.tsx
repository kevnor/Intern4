import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomAdminTab from './RoomAdminTab';
import type { RoomAdmin } from '../hooks/useRoomAdmin';
import type { ResidentForRoom, Room } from '../types';

const rooms: Room[] = [
  { id: 'r60', number: 60, type: 'husfarhybel', capacity: 1, occupants: [] },
  { id: 'r101', number: 101, type: null, capacity: 1, occupants: [] },
  {
    id: 'r150',
    number: 150,
    type: 'liten_parhybel',
    capacity: 2,
    occupants: [{ userId: 'b', userName: 'Bo', movedIn: new Date(2025, 7, 1) }],
  },
];

const make = (overrides: Partial<RoomAdmin> = {}): RoomAdmin => {
  const residents: ResidentForRoom[] = [
    { id: 'a', name: 'Anne', roomNumber: 0, isHusfar: false },
    { id: 'b', name: 'Bo', roomNumber: 150, isHusfar: false },
  ];
  return {
    residents,
    withoutRoom: [residents[0]],
    husfar: undefined,
    husfarRoom: rooms[0],
    loading: false,
    busy: false,
    error: null,
    notice: null,
    clearMessages: vi.fn(),
    changeType: vi.fn().mockResolvedValue(true),
    changeRangeType: vi.fn().mockResolvedValue(true),
    assign: vi.fn().mockResolvedValue(true),
    changeHusfar: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as RoomAdmin;
};

describe('RoomAdminTab', () => {
  it('assigns a room to a resident without one, offering only rooms with space', async () => {
    const user = userEvent.setup();
    const admin = make();
    render(<RoomAdminTab rooms={rooms} admin={admin} />);

    const select = screen.getByLabelText('Rom til Anne');
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    // Husfarhybelen is not offered to an ordinary resident.
    expect(options).toEqual([
      'Velg rom',
      '101 · Ikke satt (0 av 1)',
      '150 · Liten parhybel (1 av 2)',
    ]);

    await user.selectOptions(select, 'r150');
    await user.click(screen.getByRole('button', { name: 'Tildel rom til Anne' }));

    expect(admin.assign).toHaveBeenCalledWith('a', 'r150');
  });

  it('changes the type of one room', async () => {
    const user = userEvent.setup();
    const admin = make();
    render(<RoomAdminTab rooms={rooms} admin={admin} />);

    await user.selectOptions(screen.getAllByLabelText('Type for rom 101')[0], 'korrhybel');

    expect(admin.changeType).toHaveBeenCalledWith('r101', 'korrhybel');
  });

  it('sets a type on a range of rooms and checks the numbers first', async () => {
    const user = userEvent.setup();
    const admin = make();
    render(<RoomAdminTab rooms={rooms} admin={admin} />);

    await user.click(screen.getByRole('button', { name: 'Sett type på området' }));
    expect(screen.getByText('Skriv inn romnummer.')).toBeInTheDocument();
    expect(admin.changeRangeType).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Fra rom'), '100');
    await user.type(screen.getByLabelText('Til rom'), '110');
    await user.selectOptions(screen.getByLabelText('Type'), 'bottekott');
    await user.click(screen.getByRole('button', { name: 'Sett type på området' }));

    expect(admin.changeRangeType).toHaveBeenCalledWith(100, 110, 'bottekott');
  });

  it('makes a resident Husfar', async () => {
    const user = userEvent.setup();
    const admin = make();
    render(<RoomAdminTab rooms={rooms} admin={admin} />);

    expect(screen.getByText('Husfarhybelen er rom 60')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Ny Husfar'), 'a');
    await user.click(screen.getByRole('button', { name: 'Sett som Husfar' }));

    expect(admin.changeHusfar).toHaveBeenCalledWith('a', true);
  });

  it('shows the Husfar and lets Romsjef remove the role', async () => {
    const user = userEvent.setup();
    const admin = make({ husfar: { id: 'c', name: 'Cia', roomNumber: 60, isHusfar: true } });
    render(<RoomAdminTab rooms={rooms} admin={admin} />);

    expect(screen.getByText(/er Husfar og bor på rom 60/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fjern som Husfar' }));

    expect(admin.changeHusfar).toHaveBeenCalledWith('c', false);
  });

  it('warns when no room is husfarhybelen yet and blocks choosing a Husfar', () => {
    render(<RoomAdminTab rooms={rooms} admin={make({ husfarRoom: undefined })} />);

    expect(screen.getByText(/Velg først hvilket rom som er husfarhybelen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sett som Husfar' })).toBeDisabled();
  });

  it('shows what the database refused', () => {
    render(<RoomAdminTab rooms={rooms} admin={make({ error: 'Rommet er fullt' })} />);

    expect(screen.getByText('Rommet er fullt')).toBeInTheDocument();
  });
});
