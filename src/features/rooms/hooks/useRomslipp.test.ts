import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRomslipp } from './useRomslipp';
import {
  answerRomslipp,
  cancelRomslipp,
  closeRomslipp,
  getAvailableRooms,
  getLatestRomslipp,
  skipRomslipp,
  startRomslipp,
} from '../../../server/dao/romslippDAO';
import type { RomslippState } from '../types';

const state = (status: 'open' | 'closed' | 'cancelled'): RomslippState => ({
  round: {
    id: 'round',
    semesterKey: '2026-H',
    status,
    createdAt: new Date(2026, 9, 1),
    closedAt: null,
  },
  participants: [],
});

const setup = async (enabled = true) => {
  const hook = renderHook(() => useRomslipp(enabled));
  if (enabled) await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useRomslipp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestRomslipp).mockResolvedValue(state('open'));
    vi.mocked(getAvailableRooms).mockResolvedValue([
      { roomId: 'a', number: 273, type: null, freeSpots: 1 },
    ]);
  });

  it('loads the round and the rooms that are available while it is open', async () => {
    const { result } = await setup();

    expect(result.current.state?.round.status).toBe('open');
    expect(result.current.available).toHaveLength(1);
    expect(getAvailableRooms).toHaveBeenCalledWith('round');
  });

  it('does not ask for available rooms once the round is over', async () => {
    vi.mocked(getLatestRomslipp).mockResolvedValue(state('closed'));
    const { result } = await setup();

    expect(result.current.available).toEqual([]);
    expect(getAvailableRooms).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    await setup(false);

    expect(getLatestRomslipp).not.toHaveBeenCalled();
  });

  it('starts a round and reloads', async () => {
    vi.mocked(getLatestRomslipp).mockResolvedValue(null);
    const { result } = await setup();

    await act(async () => {
      await result.current.start('2026-H');
    });

    expect(startRomslipp).toHaveBeenCalledWith('2026-H');
    expect(getLatestRomslipp).toHaveBeenCalledTimes(2);
  });

  it('answers for myself, for someone else, skips, closes and cancels', async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.answer('a');
      await result.current.answer(null, 'u2');
      await result.current.skip('u3');
      await result.current.close();
      await result.current.cancel();
    });

    expect(answerRomslipp).toHaveBeenCalledWith('round', 'a', undefined);
    expect(answerRomslipp).toHaveBeenCalledWith('round', null, 'u2');
    expect(skipRomslipp).toHaveBeenCalledWith('round', 'u3');
    expect(closeRomslipp).toHaveBeenCalledWith('round');
    expect(cancelRomslipp).toHaveBeenCalledWith('round');
  });

  it('does not act when there is no round', async () => {
    vi.mocked(getLatestRomslipp).mockResolvedValue(null);
    const { result } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.answer('a');
    });

    expect(ok).toBe(false);
    expect(answerRomslipp).not.toHaveBeenCalled();
  });

  it('shows the database message when an answer is refused and reloads in case it changed', async () => {
    vi.mocked(answerRomslipp).mockRejectedValueOnce(new Error('Det er ikke din tur'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.answer('a');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Det er ikke din tur');
    expect(getLatestRomslipp).toHaveBeenCalledTimes(2);
  });
});
