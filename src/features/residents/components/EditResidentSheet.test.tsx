import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditResidentSheet from './EditResidentSheet';
import { updateUser } from '../../../server/dao/userDAO';
import { assignResidentToRoom } from '../../../server/dao/roomsDAO';
import type { Room } from '../../rooms/types';
import type { ResidentProfile } from '../hooks/useResidentProfile';

vi.mock('../../../server/dao/userDAO', () => ({ updateUser: vi.fn() }));

const resident: ResidentProfile = {
  id: 'r1',
  name: 'Bjørn Beboersen',
  email: 'bjorn@example.test',
  phone: '40000002',
  birthDate: undefined,
  address: { street: '', postalCode: '', city: '' },
  schoolId: 'school-ntnu',
  studyId: 'study-data',
  study: 'Datateknologi',
  studyPlace: 'NTNU',
  seniority: 1,
  roomNumber: 214,
  role: 'Halv/Halv',
  onLeave: false,
  isActive: true,
  createdAt: new Date('2025-08-01'),
};

const roles = ['Admin', 'Data', 'Halv/Halv', 'Romsjef'].map((name, index) => ({
  id: String(index + 1),
  name,
}));

const room = (number: number, overrides: Partial<Room> = {}): Room => ({
  id: `room-${number}`,
  number,
  type: null,
  capacity: 1,
  occupants: [],
  ...overrides,
});

const rooms: Room[] = [
  room(214, { occupants: [{ userId: 'r1', userName: 'Bjørn', movedIn: new Date(2025, 7, 1) }] }),
  room(150, { type: 'liten_parhybel', capacity: 2 }),
  room(151, { occupants: [{ userId: 'x', userName: 'Xena', movedIn: new Date(2025, 7, 1) }] }),
];

const renderSheet = (callerRole: string, overrides: Partial<ResidentProfile> = {}) => {
  const onSaved = vi.fn();
  render(
    <EditResidentSheet
      open
      onClose={vi.fn()}
      onSaved={onSaved}
      resident={{ ...resident, ...overrides }}
      callerRole={callerRole}
      isSelf={false}
      roles={roles}
      schools={[{ id: 'school-ntnu', name: 'NTNU' }]}
      studies={[{ id: 'study-data', name: 'Datateknologi' }]}
      rooms={rooms}
    />
  );
  return { onSaved };
};

describe('EditResidentSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateUser).mockResolvedValue(undefined);
  });

  it('saves the other changes without touching the room when it is unchanged', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderSheet('Romsjef');

    await user.clear(screen.getByLabelText(/ansiennitet/i));
    await user.type(screen.getByLabelText(/ansiennitet/i), '4');
    await user.click(screen.getByLabelText('På permisjon'));
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('r1', {
        name: 'Bjørn Beboersen',
        phone: '40000002',
        birthDate: undefined,
        seniority: 4,
        schoolId: 'school-ntnu',
        studyId: 'study-data',
        onLeave: true,
        roleId: undefined,
      })
    );
    expect(assignResidentToRoom).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('starts on the current room and moves the resident to another one', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderSheet('Romsjef');

    const select = screen.getByLabelText('Rom');
    expect(select).toHaveValue('room-214');

    await user.selectOptions(select, 'room-150');
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() => expect(assignResidentToRoom).toHaveBeenCalledWith('r1', 'room-150'));
    expect(updateUser).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('can take the resident out of their room', async () => {
    const user = userEvent.setup();
    renderSheet('Romsjef');

    await user.selectOptions(screen.getByLabelText('Rom'), '');
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() => expect(assignResidentToRoom).toHaveBeenCalledWith('r1', null));
  });

  it('does not offer rooms that are full', () => {
    renderSheet('Romsjef');

    expect(screen.getByRole('option', { name: /151 .* full/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /150 · Liten parhybel/ })).toBeEnabled();
    // Their own room stays selectable even though it is full.
    expect(screen.getByRole('option', { name: /^214/ })).toBeEnabled();
  });

  it('does not save anything when the room is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(assignResidentToRoom).mockRejectedValueOnce(new Error('Rommet er fullt'));
    const { onSaved } = renderSheet('Romsjef');

    await user.selectOptions(screen.getByLabelText('Rom'), 'room-150');
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    expect(await screen.findByText('Rommet er fullt')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('hides the role from room managers', () => {
    renderSheet('Romsjef');
    expect(screen.queryByLabelText('Rolle')).not.toBeInTheDocument();
  });

  it('lets Data change roles but not grant Admin', async () => {
    const user = userEvent.setup();
    renderSheet('Data');

    const role = screen.getByLabelText('Rolle');
    const options = Array.from((role as HTMLSelectElement).options).map((option) => option.value);
    expect(options).not.toContain('Admin');

    await user.selectOptions(role, 'Romsjef');
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));
    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('r1', expect.objectContaining({ roleId: '4' }))
    );
  });

  it('shows the server message when the save is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockRejectedValue(
      new Error('Kun Admin kan gi eller fjerne Admin-rollen')
    );
    renderSheet('Data', { role: 'Admin' });

    expect(screen.getByLabelText('Rolle')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));
    expect(
      await screen.findByText('Kun Admin kan gi eller fjerne Admin-rollen')
    ).toBeInTheDocument();
  });
});
