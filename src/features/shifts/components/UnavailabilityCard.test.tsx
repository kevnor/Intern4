import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnavailabilityCard from './UnavailabilityCard';
import type { useUnavailability } from '../hooks/useUnavailability';

const make = (overrides: Partial<ReturnType<typeof useUnavailability>> = {}) => ({
  periods: [],
  loading: false,
  error: null,
  add: vi.fn().mockResolvedValue(true),
  remove: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('UnavailabilityCard', () => {
  it('adds a single day when no end date is given', async () => {
    const user = userEvent.setup();
    const unavailability = make();
    render(<UnavailabilityCard unavailability={unavailability} today={new Date(2026, 9, 1)} />);

    fireEvent.change(screen.getByLabelText('Fra dato'), { target: { value: '2026-11-05' } });
    await user.click(screen.getByRole('button', { name: 'Legg til' }));

    expect(unavailability.add).toHaveBeenCalledWith(
      new Date(2026, 10, 5),
      new Date(2026, 10, 5),
      ''
    );
  });

  it('adds a range with a note', async () => {
    const user = userEvent.setup();
    const unavailability = make();
    render(<UnavailabilityCard unavailability={unavailability} today={new Date(2026, 9, 1)} />);

    fireEvent.change(screen.getByLabelText('Fra dato'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('Til dato'), { target: { value: '2026-11-09' } });
    await user.type(screen.getByLabelText('Merknad (valgfritt)'), 'Hjemme');
    await user.click(screen.getByRole('button', { name: 'Legg til' }));

    expect(unavailability.add).toHaveBeenCalledWith(
      new Date(2026, 10, 5),
      new Date(2026, 10, 9),
      'Hjemme'
    );
  });

  it('does not allow an end date before the start', () => {
    render(<UnavailabilityCard unavailability={make()} today={new Date(2026, 9, 1)} />);

    fireEvent.change(screen.getByLabelText('Fra dato'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('Til dato'), { target: { value: '2026-11-01' } });

    expect(screen.getByText('Må være samme dag eller senere.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Legg til' })).toBeDisabled();
  });

  it('lists existing periods and removes one', async () => {
    const user = userEvent.setup();
    const unavailability = make({
      periods: [
        {
          id: 'u1',
          userId: 'me',
          from: new Date(2026, 10, 5),
          to: new Date(2026, 10, 9),
          note: 'Hjemme',
        },
      ],
    });
    render(<UnavailabilityCard unavailability={unavailability} />);

    expect(screen.getByText('Hjemme')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Fjern/ }));

    expect(unavailability.remove).toHaveBeenCalledWith('u1');
  });
});
