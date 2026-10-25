import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useShifts } from './useShifts';
import { createShiftSlots, getShifts } from '../../../server/dao/shiftsDAO';

vi.mock('../../../server/dao/shiftsDAO', () => ({
  getShifts: vi.fn(),
  createShiftSlots: vi.fn(),
}));

const FROM = new Date(2026, 9, 19);
const TO = new Date(2026, 9, 21);

const setup = async () => {
  const hook = renderHook(() => useShifts(FROM, TO));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useShifts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getShifts).mockResolvedValue([]);
    vi.mocked(createShiftSlots).mockResolvedValue(undefined);
  });

  it('creates the slots for the period and reloads', async () => {
    const { result } = await setup();

    let ok = false;
    await act(async () => {
      ok = await result.current.createSlots();
    });

    expect(ok).toBe(true);
    expect(createShiftSlots).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createShiftSlots).mock.calls[0][0].length).toBeGreaterThan(0);
    expect(getShifts).toHaveBeenCalledTimes(2);
  });

  it('says so instead of throwing when creating the slots fails', async () => {
    vi.mocked(createShiftSlots).mockRejectedValueOnce(
      new Error('Could not create shifts: permission denied for table vakt_shifts')
    );
    const { result } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.createSlots();
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Du har ikke tilgang til å gjøre dette.');
  });

  it('explains a lost connection when the shifts cannot be loaded', async () => {
    vi.mocked(getShifts).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = await setup();

    expect(result.current.error).toBe(
      'Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.'
    );
  });
});
