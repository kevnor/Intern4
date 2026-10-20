import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Registatus from './Registatus';

vi.mock('../../../../app/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'manager', role: 'Regisjef' }, loading: false }),
}));
vi.mock('../../../../server/dao/userDAO', () => ({
  getActiveUsersWithRole: vi.fn().mockResolvedValue([
    {
      id: 'a',
      name: 'Anne Mangler',
      email: 'a@x.no',
      role: 'Halv/Halv',
      isActive: true,
      onLeave: false,
    },
    {
      id: 'b',
      name: 'Bo Ferdig',
      email: 'b@x.no',
      role: 'Halv/Halv',
      isActive: true,
      onLeave: false,
    },
    {
      id: 'c',
      name: 'Cia Borte',
      email: 'c@x.no',
      role: 'Halv/Halv',
      isActive: true,
      onLeave: true,
    },
    {
      id: 'd',
      name: 'Dag Admin',
      email: 'd@x.no',
      role: 'Admin',
      isActive: true,
      onLeave: false,
    },
  ]),
}));
vi.mock('../../../../server/dao/regiDAO', () => ({
  getApprovedRegiHoursByUserSince: vi.fn().mockResolvedValue({ a: 4, b: 24 }),
}));

describe('Registatus', () => {
  it('shows progress per resident and filters by status', async () => {
    const user = userEvent.setup();
    render(<Registatus />);

    const table = await screen.findByRole('table');
    expect(
      within(table).getByRole('meter', { name: 'Anne Mangler: 4 t av 24 t' })
    ).toBeInTheDocument();
    expect(within(table).getByText('Mangler timer')).toBeInTheDocument();
    expect(within(table).getByText('Oppfylt')).toBeInTheDocument();
    expect(within(table).getByText('Permisjon')).toBeInTheDocument();
    expect(within(table).getByText('Ingen krav')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Mangler (1)' }));

    expect(within(table).getByText('Anne Mangler')).toBeInTheDocument();
    expect(within(table).queryByText('Bo Ferdig')).not.toBeInTheDocument();
    expect(within(table).queryByText('Cia Borte')).not.toBeInTheDocument();
  });
});
