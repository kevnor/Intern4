import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShiftEditModal from './ShiftEditModal';
import type { Shift } from '../types';

const shift: Shift = {
  id: 's1',
  startsAt: new Date(2026, 9, 24, 16),
  endsAt: new Date(2026, 9, 25, 0),
  slotType: 'kveld',
  userId: 'a',
  userName: 'Anne',
  status: 'draft',
  swapRequested: false,
  swapOfferAmount: null,
  swapNote: null,
};

const users = [
  { id: 'a', name: 'Anne', email: 'a@x.no', role: 'Full Vakt', onLeave: false, isActive: true },
  { id: 'b', name: 'Bjørn', email: 'b@x.no', role: 'Full Regi', onLeave: true, isActive: true },
];

describe('ShiftEditModal', () => {
  it('starts on the current holder and saves a new one', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <ShiftEditModal shift={shift} users={users} busy={false} onSave={onSave} onClose={onClose} />
    );

    const select = screen.getByLabelText('Hvem har vakten?');
    expect(select).toHaveValue('a');

    await user.selectOptions(select, 'b');
    await user.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(onSave).toHaveBeenCalledWith('s1', 'b');
    expect(onClose).toHaveBeenCalled();
  });

  it('can free the shift', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <ShiftEditModal shift={shift} users={users} busy={false} onSave={onSave} onClose={vi.fn()} />
    );

    await user.selectOptions(screen.getByLabelText('Hvem har vakten?'), '');
    await user.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(onSave).toHaveBeenCalledWith('s1', null);
  });

  it('stays open when saving fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ShiftEditModal
        shift={shift}
        users={users}
        busy={false}
        onSave={vi.fn().mockResolvedValue(false)}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('marks residents on leave', () => {
    render(
      <ShiftEditModal shift={shift} users={users} busy={false} onSave={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByRole('option', { name: /Bjørn.*permisjon/ })).toBeInTheDocument();
  });

  it('shows why saving failed, inside the dialog', () => {
    render(
      <ShiftEditModal
        shift={shift}
        users={users}
        busy={false}
        error="Du har ikke tilgang til å gjøre dette."
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Du har ikke tilgang til å gjøre dette.');
  });
});
