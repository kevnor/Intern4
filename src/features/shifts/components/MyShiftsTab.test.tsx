import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MyShiftsTab from './MyShiftsTab';
import type { Shift } from '../types';

const ME = 'me';
const NOW = new Date(2026, 9, 20, 12);

const shift = (day: number, hour: number, userId: string | null): Shift => ({
  id: `${day}-${hour}`,
  startsAt: new Date(2026, 9, day, hour),
  endsAt: new Date(2026, 9, day, hour + 8),
  slotType: hour === 0 ? 'natt' : hour === 8 ? 'dag' : 'kveld',
  userId,
  userName: userId,
  status: 'published',
  swapRequested: false,
  swapOfferAmount: null,
  swapNote: null,
});

const renderTab = (shifts: Shift[], role = 'Full Vakt') =>
  render(
    <MyShiftsTab
      shifts={shifts}
      loading={false}
      userId={ME}
      role={role}
      totalHours={48}
      now={NOW}
    />
  );

describe('MyShiftsTab', () => {
  it('counts finished shifts towards the vakt requirement', () => {
    renderTab([shift(15, 16, ME), shift(16, 16, ME), shift(22, 16, ME), shift(21, 16, 'other')]);

    expect(screen.getByText('16 t')).toBeInTheDocument();
    expect(screen.getByText('av 48 t dette semesteret')).toBeInTheDocument();
  });

  it('lists only my upcoming shifts and flags tomorrow', () => {
    renderTab([shift(21, 16, ME), shift(23, 0, ME), shift(22, 16, 'other')]);

    expect(screen.getByText('2 gjenstår')).toBeInTheDocument();
    expect(screen.getByText('I morgen')).toBeInTheDocument();
    expect(screen.getByText('Kveld · 16–24')).toBeInTheDocument();
    expect(screen.getByText('Natt · 24–08')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is planned', () => {
    renderTab([]);

    expect(screen.getByText('Ingen kommende vakter')).toBeInTheDocument();
  });

  it('says so when the role has no vakt requirement', () => {
    renderTab([], 'Full Regi');

    expect(screen.getByText('Du har ikke vaktkrav dette semesteret.')).toBeInTheDocument();
  });

  it('lets me ask for a swap on an upcoming shift', async () => {
    const user = userEvent.setup();
    const onSwap = vi.fn();
    const upcoming = shift(21, 16, ME);
    render(
      <MyShiftsTab
        shifts={[upcoming]}
        loading={false}
        userId={ME}
        role="Full Vakt"
        totalHours={48}
        onSwap={onSwap}
        now={NOW}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Bytt vakt/ }));

    expect(onSwap).toHaveBeenCalledWith(upcoming);
  });

  it('marks a shift that is up for swap', () => {
    render(
      <MyShiftsTab
        shifts={[{ ...shift(21, 16, ME), swapRequested: true }]}
        loading={false}
        userId={ME}
        role="Full Vakt"
        totalHours={48}
        onSwap={vi.fn()}
        now={NOW}
      />
    );

    expect(screen.getByText('Bytte søkes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Endre bytte for vakt/ })).toBeInTheDocument();
  });
});
