import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditResidentSheet from './EditResidentSheet';
import { updateUser } from '../../../server/dao/userDAO';
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
    />
  );
  return { onSaved };
};

describe('EditResidentSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateUser).mockResolvedValue(undefined);
  });

  it('rejects room numbers outside the house and saves valid changes', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderSheet('Romsjef');

    const room = screen.getByLabelText(/romnummer/i);
    await user.clear(room);
    await user.type(room, '999');
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));
    expect(await screen.findByText(/Romnummer må være/)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();

    await user.clear(room);
    await user.type(room, '150');
    await user.clear(screen.getByLabelText(/ansiennitet/i));
    await user.type(screen.getByLabelText(/ansiennitet/i), '4');
    await user.click(screen.getByLabelText('På permisjon'));
    await user.click(screen.getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('r1', {
        name: 'Bjørn Beboersen',
        phone: '40000002',
        birthDate: undefined,
        roomNumber: 150,
        seniority: 4,
        schoolId: 'school-ntnu',
        studyId: 'study-data',
        onLeave: true,
        roleId: undefined,
      })
    );
    expect(onSaved).toHaveBeenCalled();
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
