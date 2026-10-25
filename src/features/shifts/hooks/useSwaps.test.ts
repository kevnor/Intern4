import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSwaps } from './useSwaps';
import {
  cancelSwap,
  claimShift,
  getSwapLog,
  requestSwap,
  setSwapPaid,
} from '../../../server/dao/shiftsDAO';
import type { SwapLogEntry } from '../types';

vi.mock('../../../server/dao/shiftsDAO', () => ({
  getSwapLog: vi.fn(),
  requestSwap: vi.fn().mockResolvedValue(undefined),
  cancelSwap: vi.fn().mockResolvedValue(undefined),
  claimShift: vi.fn().mockResolvedValue(undefined),
  setSwapPaid: vi.fn().mockResolvedValue(undefined),
}));

const entry = (id: string, from: string | null, to: string | null): SwapLogEntry => ({
  id,
  shiftStartsAt: new Date(2026, 10, 2, 16),
  slotType: 'kveld',
  fromUserId: from,
  fromUserName: from,
  toUserId: to,
  toUserName: to,
  amount: 100,
  paid: false,
  createdAt: new Date(2026, 9, 20),
});

const setup = async () => {
  const reloadShifts = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useSwaps('me', reloadShifts));
  await waitFor(() => expect(getSwapLog).toHaveBeenCalled());
  return { ...hook, reloadShifts };
};

describe('useSwaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSwapLog).mockResolvedValue([
      entry('a', 'me', 'x'),
      entry('b', 'y', 'me'),
      entry('c', 'y', 'x'),
    ]);
  });

  it('only keeps swaps the user took part in', async () => {
    const { result } = await setup();

    await waitFor(() => expect(result.current.log.map((item) => item.id)).toEqual(['a', 'b']));
  });

  it('requests a swap and refreshes the schedule', async () => {
    const { result, reloadShifts } = await setup();

    let ok = false;
    await act(async () => {
      ok = await result.current.request('s1', 150, 'trenger fri');
    });

    expect(ok).toBe(true);
    expect(requestSwap).toHaveBeenCalledWith('s1', 150, 'trenger fri');
    expect(reloadShifts).toHaveBeenCalled();
  });

  it('cancels, claims and marks paid', async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.cancel('s1');
      await result.current.claim('s2');
      await result.current.markPaid('a', true);
    });

    expect(cancelSwap).toHaveBeenCalledWith('s1');
    expect(claimShift).toHaveBeenCalledWith('s2');
    expect(setSwapPaid).toHaveBeenCalledWith('a', true);
  });

  it('reports a failed claim and reloads the schedule instead of throwing', async () => {
    vi.mocked(claimShift).mockRejectedValueOnce(new Error('taken'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, reloadShifts } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.claim('s2');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/Kunne ikke ta vakten/);
    expect(reloadShifts).toHaveBeenCalled();
  });

  it('keeps the database’s own message but hides raw technical ones', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(claimShift).mockRejectedValueOnce(
      new Error('Could not claim shift: Vakten er ikke lenger ledig for bytte')
    );
    const { result } = await setup();

    await act(async () => {
      await result.current.claim('s1');
    });
    expect(result.current.error).toBe('Vakten er ikke lenger ledig for bytte');

    vi.mocked(requestSwap).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await result.current.request('s1', null, '');
    });
    expect(result.current.error).toBe(
      'Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.'
    );
  });
});
