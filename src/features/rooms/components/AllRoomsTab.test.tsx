import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AllRoomsTab from './AllRoomsTab';
import type { Room } from '../types';

const movedIn = new Date(2025, 7, 1);

const rooms: Room[] = [
  { id: 'a', number: 101, type: 'bottekott', capacity: 1, occupants: [] },
  {
    id: 'b',
    number: 150,
    type: 'liten_parhybel',
    capacity: 2,
    occupants: [{ userId: 'u1', userName: 'Anne Hansen', movedIn }],
  },
  {
    id: 'c',
    number: 210,
    type: 'korrhybel',
    capacity: 1,
    occupants: [{ userId: 'u2', userName: 'Bo Olsen', movedIn }],
  },
];

const renderTab = (loading = false) =>
  render(
    <MemoryRouter initialEntries={['/rom/alle']}>
      <Routes>
        <Route
          path="/rom/alle"
          element={<AllRoomsTab rooms={rooms} loading={loading} onRefresh={vi.fn()} />}
        />
        <Route path="/rom/alle/:number" element={<p>Detaljer for rommet</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('AllRoomsTab', () => {
  it('lists every room with type, residents and whether there is space', () => {
    renderTab();
    const table = screen.getByRole('table');

    expect(within(table).getByText('Anne Hansen')).toBeInTheDocument();
    expect(within(table).getByText('Liten parhybel')).toBeInTheDocument();
    // Room 101 is empty, and the parhybel with one person still has one place left.
    expect(within(table).getAllByText('Ledig plass')).toHaveLength(2);
    expect(within(table).getAllByText('Opptatt')).toHaveLength(1);
  });

  it('searches by resident name', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.type(screen.getByLabelText('Søk i rom'), 'olsen');

    const table = screen.getByRole('table');
    expect(within(table).getByText('Bo Olsen')).toBeInTheDocument();
    expect(within(table).queryByText('Anne Hansen')).not.toBeInTheDocument();
  });

  it('can show only rooms with space', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('radio', { name: 'Ledige (2)' }));

    const table = screen.getByRole('table');
    expect(within(table).queryByText('Bo Olsen')).not.toBeInTheDocument();
    expect(within(table).getByText('Anne Hansen')).toBeInTheDocument();
  });

  it('opens the room when a row is picked', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(within(screen.getByRole('table')).getByText('Bo Olsen'));

    expect(await screen.findByText('Detaljer for rommet')).toBeInTheDocument();
  });
});
