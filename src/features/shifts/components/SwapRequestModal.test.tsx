import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SwapRequestModal from './SwapRequestModal';
import type { Shift } from '../types';

const shift: Shift = {
  id: 's1',
  startsAt: new Date(2026, 10, 2, 16),
  endsAt: new Date(2026, 10, 3, 0),
  slotType: 'kveld',
  userId: 'me',
  userName: 'Meg',
  status: 'published',
  swapRequested: false,
  swapOfferAmount: null,
  swapNote: null,
};

const renderModal = (
  overrides: Partial<Shift> = {},
  onRequest = vi.fn().mockResolvedValue(true)
) => {
  const onClose = vi.fn();
  const onCancelSwap = vi.fn().mockResolvedValue(true);
  render(
    <SwapRequestModal
      shift={{ ...shift, ...overrides }}
      busy={false}
      onRequest={onRequest}
      onCancelSwap={onCancelSwap}
      onClose={onClose}
    />
  );
  return { onRequest, onCancelSwap, onClose };
};

describe('SwapRequestModal', () => {
  it('asks for a swap with an offer and a note', async () => {
    const user = userEvent.setup();
    const { onRequest, onClose } = renderModal();

    await user.type(screen.getByLabelText('Tilbud (kr, valgfritt)'), '150');
    await user.type(screen.getByLabelText('Merknad (valgfritt)'), 'Eksamen');
    await user.click(screen.getByRole('button', { name: 'Be om bytte' }));

    expect(onRequest).toHaveBeenCalledWith('s1', 150, 'Eksamen');
    expect(onClose).toHaveBeenCalled();
  });

  it('sends no amount when the offer is left empty', async () => {
    const user = userEvent.setup();
    const { onRequest } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Be om bytte' }));

    expect(onRequest).toHaveBeenCalledWith('s1', null, '');
  });

  it('rejects a negative offer', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Tilbud (kr, valgfritt)'), '-5');

    expect(screen.getByText('Skriv inn et beløp på 0 kr eller mer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Be om bytte' })).toBeDisabled();
  });

  it('lets me change or cancel an existing request', async () => {
    const user = userEvent.setup();
    const { onCancelSwap, onClose } = renderModal({
      swapRequested: true,
      swapOfferAmount: 200,
      swapNote: 'Syk',
    });

    expect(screen.getByLabelText('Tilbud (kr, valgfritt)')).toHaveValue(200);
    expect(screen.getByLabelText('Merknad (valgfritt)')).toHaveValue('Syk');

    await user.click(screen.getByRole('button', { name: 'Avbryt bytte' }));

    expect(onCancelSwap).toHaveBeenCalledWith('s1');
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open when the request fails', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({}, vi.fn().mockResolvedValue(false));

    await user.click(screen.getByRole('button', { name: 'Be om bytte' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
