import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SwapsTab from './SwapsTab';
import type { Shift, SwapLogEntry } from '../types';

const NOW = new Date(2026, 9, 20, 12);

const shift = (overrides: Partial<Shift>): Shift => ({
  id: 's1',
  startsAt: new Date(2026, 9, 22, 16),
  endsAt: new Date(2026, 9, 23, 0),
  slotType: 'kveld',
  userId: 'kari',
  userName: 'Kari',
  status: 'published',
  swapRequested: true,
  swapOfferAmount: null,
  swapNote: null,
  ...overrides,
});

const entry = (overrides: Partial<SwapLogEntry>): SwapLogEntry => ({
  id: 'l1',
  shiftStartsAt: new Date(2026, 9, 10, 16),
  slotType: 'kveld',
  fromUserId: 'me',
  fromUserName: 'Meg',
  toUserId: 'kari',
  toUserName: 'Kari',
  amount: 100,
  paid: false,
  createdAt: new Date(2026, 9, 5),
  ...overrides,
});

const renderTab = (shifts: Shift[], log: SwapLogEntry[] = []) => {
  const handlers = {
    onClaim: vi.fn(),
    onManageMine: vi.fn(),
    onMarkPaid: vi.fn(),
  };
  render(
    <SwapsTab
      shifts={shifts}
      log={log}
      loading={false}
      busy={false}
      userId="me"
      now={NOW}
      {...handlers}
    />
  );
  return handlers;
};

describe('SwapsTab', () => {
  it('lists other residents’ open swaps with the offer and lets me take one', async () => {
    const user = userEvent.setup();
    const open = shift({ swapOfferAmount: 150, swapNote: 'Eksamen' });
    const { onClaim } = renderTab([open, shift({ id: 'own', userId: 'me' })]);

    expect(screen.getByText('Kari · Eksamen')).toBeInTheDocument();
    expect(screen.getByText(/Du får.*150/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ta vakt/ }));

    expect(onClaim).toHaveBeenCalledWith(open);
  });

  it('shows an empty state when nothing is up for swap', () => {
    renderTab([shift({ swapRequested: false })]);

    expect(screen.getByText('Ingen vakter til bytte')).toBeInTheDocument();
  });

  it('lists my own open requests and lets me change them', async () => {
    const user = userEvent.setup();
    const mine = shift({ id: 'mine', userId: 'me', userName: 'Meg' });
    const { onManageMine } = renderTab([mine]);

    await user.click(screen.getByRole('button', { name: 'Endre' }));

    expect(onManageMine).toHaveBeenCalledWith(mine);
  });

  it('shows whether I pay or get paid and lets me confirm payment', async () => {
    const user = userEvent.setup();
    const { onMarkPaid } = renderTab(
      [],
      [
        entry({}),
        entry({
          id: 'l2',
          fromUserId: 'kari',
          fromUserName: 'Kari',
          toUserId: 'me',
          toUserName: 'Meg',
          amount: 50,
        }),
        entry({ id: 'l3', amount: null }),
      ]
    );

    expect(screen.getByText(/Du betaler.*100.*til Kari/)).toBeInTheDocument();
    expect(screen.getByText(/Du får.*50.*fra Kari/)).toBeInTheDocument();
    expect(screen.getByText('Uten betaling')).toBeInTheDocument();

    await user.click(screen.getAllByRole('checkbox', { name: 'Betalt' })[0]);

    expect(onMarkPaid).toHaveBeenCalledWith('l1', true);
  });
});
