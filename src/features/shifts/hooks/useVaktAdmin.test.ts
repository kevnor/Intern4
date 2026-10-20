import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVaktAdmin } from './useVaktAdmin';
import {
  assignShiftUsers,
  clearDraftAssignments,
  publishShifts,
} from '../../../server/dao/shiftsDAO';
import { getUnavailability } from '../../../server/dao/unavailabilityDAO';
import { getActiveUsersWithRole } from '../../../server/dao/userDAO';
import type { Shift } from '../types';

vi.mock('../../../server/dao/shiftsDAO', () => ({
  assignShiftUsers: vi.fn().mockResolvedValue(undefined),
  clearDraftAssignments: vi.fn().mockResolvedValue(undefined),
  publishShifts: vi.fn().mockResolvedValue(undefined),
  setShiftUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../server/dao/unavailabilityDAO', () => ({
  getUnavailability: vi.fn(),
}));
vi.mock('../../../server/dao/userDAO', () => ({ getActiveUsersWithRole: vi.fn() }));

const FROM = new Date(2026, 9, 19);
const TO = new Date(2026, 9, 26);

const shift = (id: string, day: number, hour: number, overrides: Partial<Shift> = {}): Shift => ({
  id,
  startsAt: new Date(2026, 9, day, hour),
  endsAt: new Date(2026, 9, day, hour + 8),
  slotType: hour === 0 ? 'natt' : 'kveld',
  userId: null,
  userName: null,
  status: 'draft',
  swapRequested: false,
  swapOfferAmount: null,
  swapNote: null,
  ...overrides,
});

const user = (id: string, role: string, onLeave = false) => ({
  id,
  name: id,
  email: `${id}@example.com`,
  role,
  onLeave,
  isActive: true,
});

const setup = async (shifts: Shift[]) => {
  const reload = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useVaktAdmin({ enabled: true, shifts, from: FROM, to: TO, totalHours: 48, reload })
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, reload };
};

describe('useVaktAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveUsersWithRole).mockResolvedValue([
      user('a', 'Full Vakt'),
      user('b', 'Full Regi'),
    ]);
    vi.mocked(getUnavailability).mockResolvedValue([]);
  });

  it('assigns empty draft shifts to residents with a vakt requirement and reloads', async () => {
    const { result, reload } = await setup([shift('s1', 19, 16), shift('s2', 21, 16)]);

    await act(async () => {
      await result.current.autoAssign();
    });

    const rows = vi.mocked(assignShiftUsers).mock.calls[0][0];
    expect(rows.map((row) => [row.id, row.userId])).toEqual([
      ['s1', 'a'],
      ['s2', 'a'],
    ]);
    expect(rows[0].startsAt).toEqual(new Date(2026, 9, 19, 16));
    expect(reload).toHaveBeenCalled();
    expect(result.current.lastRun?.unfilled).toEqual([]);
  });

  it('leaves published shifts alone but counts them towards the target', async () => {
    const shifts = [
      shift('p1', 19, 16, { status: 'published', userId: 'a' }),
      shift('p2', 20, 16, { status: 'published' }),
      shift('d1', 21, 16),
    ];
    const { result } = await setup(shifts);

    await act(async () => {
      await result.current.autoAssign();
    });

    const rows = vi.mocked(assignShiftUsers).mock.calls[0][0];
    expect(rows.map((row) => row.id)).toEqual(['d1']);
  });

  it('lists residents with a requirement and how many shifts they have', async () => {
    const { result } = await setup([shift('s1', 19, 16, { userId: 'a' })]);

    expect(result.current.rows).toEqual([
      expect.objectContaining({ id: 'a', targetShifts: 6, assignedShifts: 1 }),
    ]);
    expect(result.current.stats).toEqual({ total: 1, filled: 1, drafts: 1, published: 0 });
  });

  it('clears and publishes the semester', async () => {
    const { result, reload } = await setup([shift('s1', 19, 16)]);

    await act(async () => {
      await result.current.clearDrafts();
      await result.current.publish();
    });

    expect(clearDraftAssignments).toHaveBeenCalledWith(FROM, TO);
    expect(publishShifts).toHaveBeenCalledWith(FROM, TO);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('reports a failure instead of throwing', async () => {
    vi.mocked(publishShifts).mockRejectedValueOnce(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup([shift('s1', 19, 16)]);

    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.error).toBe('Kunne ikke publisere vaktplanen.');
  });
});
