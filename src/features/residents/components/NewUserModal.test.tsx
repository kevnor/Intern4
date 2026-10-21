import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewUserModal from './NewUserModal';
import { createUser } from '../../../server/dao/userDAO';
import type { Room } from '../../rooms/types';

vi.mock('../../../server/dao/userDAO', () => ({ createUser: vi.fn() }));

const rooms: Room[] = [
  { id: 'r60', number: 60, type: 'husfarhybel', capacity: 1, occupants: [] },
  { id: 'r101', number: 101, type: 'bottekott', capacity: 1, occupants: [] },
  {
    id: 'r102',
    number: 102,
    type: 'korrhybel',
    capacity: 1,
    occupants: [{ userId: 'x', userName: 'Xena', movedIn: new Date(2025, 7, 1) }],
  },
  {
    id: 'r150',
    number: 150,
    type: 'liten_parhybel',
    capacity: 2,
    occupants: [{ userId: 'y', userName: 'Yngve', movedIn: new Date(2025, 7, 1) }],
  },
];

const renderModal = () =>
  render(
    <NewUserModal
      open
      onClose={vi.fn()}
      onCreated={vi.fn()}
      roles={[{ id: '7', name: 'Halv/Halv' }]}
      rolesLoading={false}
      schools={[{ id: 'school-annet', name: 'Annet' }]}
      studies={[{ id: 'study-annet', name: 'Annet' }]}
      lookupsLoading={false}
      rooms={rooms}
    />
  );

describe('NewUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUser).mockResolvedValue({ initialPassword: 'pw' } as never);
  });

  it('only offers rooms with space, and not husfarhybelen', () => {
    renderModal();

    const labels = within(screen.getByLabelText('Rom'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toEqual([
      'Ingen rom',
      '101 · Bøttekott (0 av 1)',
      '150 · Liten parhybel (1 av 2)',
    ]);
  });

  it('creates the resident with the chosen room', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/^Navn/), 'Nora Ny');
    await user.type(screen.getByLabelText(/^E-post/), 'nora@example.test');
    await user.selectOptions(screen.getByLabelText('Rom'), '150');
    await user.click(screen.getByRole('button', { name: 'Legg til bruker' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ roomNumber: 150 }))
    );
  });
});
