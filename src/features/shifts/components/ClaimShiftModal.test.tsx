import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClaimShiftModal from './ClaimShiftModal';
import type { Shift } from '../types';

const shift: Shift = {
  id: 's1',
  startsAt: new Date(2026, 10, 2, 16),
  endsAt: new Date(2026, 10, 3, 0),
  slotType: 'kveld',
  userId: 'kari',
  userName: 'Kari',
  status: 'published',
  swapRequested: true,
  swapOfferAmount: 150,
  swapNote: 'Eksamen',
};

describe('ClaimShiftModal', () => {
  it('shows who gives the shift away and what they offer, and claims it', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <ClaimShiftModal
        shift={shift}
        busy={false}
        restConflict={false}
        onClaim={onClaim}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Kari')).toBeInTheDocument();
    // The person giving the shift away pays the one who takes it.
    expect(screen.getByText('Du får')).toBeInTheDocument();
    expect(screen.getByText(/150.*kr fra Kari/)).toBeInTheDocument();
    expect(screen.getByText('Eksamen')).toBeInTheDocument();
    expect(screen.queryByText(/mindre enn 12 timer/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ta vakten' }));

    expect(onClaim).toHaveBeenCalledWith('s1');
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when there is no payment', () => {
    render(
      <ClaimShiftModal
        shift={{ ...shift, swapOfferAmount: null }}
        busy={false}
        restConflict={false}
        onClaim={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Ingen betaling')).toBeInTheDocument();
  });

  it('warns about too little rest but still allows claiming', () => {
    render(
      <ClaimShiftModal
        shift={shift}
        busy={false}
        restConflict
        onClaim={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/mindre enn 12 timer hvile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ta vakten' })).toBeEnabled();
  });

  it('stays open when claiming fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ClaimShiftModal
        shift={shift}
        busy={false}
        restConflict={false}
        onClaim={vi.fn().mockResolvedValue(false)}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ta vakten' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
