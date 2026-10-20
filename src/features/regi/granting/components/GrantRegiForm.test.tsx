import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GrantRegiForm from './GrantRegiForm';
import { addRegiLog } from '../../../../server/dao/regiDAO';
import { formatDateColumnValue } from '../../../../shared/utils/date';

const RESIDENT = '22222222-2222-4222-8222-222222222222';

vi.mock('../../../../app/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'manager-id', role: 'Regisjef' } }),
}));
vi.mock('../../../../server/dao/categoriesDAO', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: '1', name: 'Arrangement', color: '#BE185D', isActive: true, createdAt: new Date() },
    { id: '2', name: 'Regi', color: '#8B1E3F', isActive: true, createdAt: new Date() },
  ]),
}));
vi.mock('../../../../server/dao/userDAO', () => ({
  getActiveUsersWithRole: vi.fn().mockResolvedValue([
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Bjørn Beboer',
      email: 'b@x.no',
      isActive: true,
      onLeave: false,
    },
  ]),
}));
vi.mock('../../../../server/dao/regiDAO', () => ({ addRegiLog: vi.fn().mockResolvedValue('1') }));

describe('GrantRegiForm', () => {
  it('grants approved hours with Oslo date and Regi as default type', async () => {
    const user = userEvent.setup();
    render(<GrantRegiForm />);

    await screen.findByRole('option', { name: /bjørn beboer/i });
    expect(screen.getByLabelText(/dato/i)).toHaveValue(formatDateColumnValue(new Date()));
    expect(screen.getByLabelText(/arbeidets art/i)).toHaveValue('Regi');

    await user.selectOptions(screen.getByLabelText(/beboer/i), RESIDENT);
    await user.type(screen.getByLabelText(/tittel/i), 'Dugnad');
    await user.type(screen.getByLabelText(/timer/i), '3');
    await user.type(screen.getByLabelText(/beskrivelse/i), 'Vårdugnad i hagen');
    await user.click(screen.getByRole('button', { name: 'Registrer og godkjenn' }));

    await waitFor(() =>
      expect(addRegiLog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: RESIDENT, hours: 3, type: 'Regi' }),
        { autoApprove: true, approvedByUuid: 'manager-id' }
      )
    );
    expect(await screen.findByText('Registrert og godkjent for Bjørn Beboer.')).toBeInTheDocument();
  });

  it('requires a resident', async () => {
    const user = userEvent.setup();
    render(<GrantRegiForm />);

    await screen.findByRole('option', { name: /bjørn beboer/i });
    await user.click(screen.getByRole('button', { name: 'Registrer og godkjenn' }));

    expect(await screen.findByText('Velg en beboer')).toBeInTheDocument();
  });

  it('can be opened for a specific resident', async () => {
    render(<GrantRegiForm initialUserId="22222222-2222-4222-8222-222222222222" hideHeading />);

    await screen.findByRole('option', { name: /bjørn beboer/i });
    expect(screen.getByLabelText(/beboer/i)).toHaveValue('22222222-2222-4222-8222-222222222222');
    expect(screen.queryByRole('heading', { name: 'Gi regitimer' })).not.toBeInTheDocument();
  });
});
