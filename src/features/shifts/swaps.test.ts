import { describe, expect, it } from 'vitest';
import { canRequestSwap, formatKroner, getOpenSwaps, hasRestConflict } from './swaps';
import type { Shift } from './types';

const NOW = new Date(2026, 9, 20, 12);

const shift = (overrides: Partial<Shift> & { day?: number; hour?: number }): Shift => {
  const { day = 22, hour = 16, ...rest } = overrides;
  return {
    id: `${day}-${hour}`,
    startsAt: new Date(2026, 9, day, hour),
    endsAt: new Date(2026, 9, day, hour + 8),
    slotType: 'kveld',
    userId: 'other',
    userName: 'Kari',
    status: 'published',
    swapRequested: false,
    swapOfferAmount: null,
    swapNote: null,
    ...rest,
  };
};

describe('canRequestSwap', () => {
  it('allows my published upcoming shifts', () => {
    expect(canRequestSwap(shift({ userId: 'me' }), 'me', NOW)).toBe(true);
  });

  it('rejects other people’s, draft and past shifts', () => {
    expect(canRequestSwap(shift({}), 'me', NOW)).toBe(false);
    expect(canRequestSwap(shift({ userId: 'me', status: 'draft' }), 'me', NOW)).toBe(false);
    expect(canRequestSwap(shift({ userId: 'me', day: 19 }), 'me', NOW)).toBe(false);
  });
});

describe('getOpenSwaps', () => {
  it('lists upcoming published swaps from other residents', () => {
    const open = shift({ id: 'open', swapRequested: true });
    const result = getOpenSwaps(
      [
        open,
        shift({ id: 'mine', swapRequested: true, userId: 'me' }),
        shift({ id: 'past', swapRequested: true, day: 19 }),
        shift({ id: 'draft', swapRequested: true, status: 'draft' }),
        shift({ id: 'plain' }),
      ],
      'me',
      NOW
    );

    expect(result).toEqual([open]);
  });
});

describe('hasRestConflict', () => {
  const mine = shift({ id: 'mine', userId: 'me', day: 22, hour: 16 });

  it('warns when the shift is right after one of mine', () => {
    expect(hasRestConflict([mine], 'me', shift({ id: 't', day: 23, hour: 0 }))).toBe(true);
  });

  it('warns when the shift is right before one of mine', () => {
    expect(hasRestConflict([mine], 'me', shift({ id: 't', day: 22, hour: 0 }))).toBe(true);
  });

  it('does not warn with enough rest or on other people’s shifts', () => {
    expect(hasRestConflict([mine], 'me', shift({ id: 't', day: 24, hour: 16 }))).toBe(false);
    expect(
      hasRestConflict([shift({ id: 'x', userId: 'someone', day: 23, hour: 0 })], 'me', mine)
    ).toBe(false);
  });
});

describe('formatKroner', () => {
  it('formats amounts', () => {
    expect(formatKroner(150)).toContain('150');
    expect(formatKroner(150)).toContain('kr');
  });
});
