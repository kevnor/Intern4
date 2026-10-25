import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelMoveOut,
  getOffboardingPreview,
  getResidentEvents,
  planMoveOut,
} from './offboardingDAO';
import { supabase } from '../supabaseClient';

// The setup file replaces this module for component tests; here the real one is under test.
vi.unmock('./offboardingDAO');
vi.mock('../supabaseClient', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const eventsQuery = (result: { data?: unknown; error?: { message: string } | null }) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  return chain;
};

describe('offboardingDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks the database what moving out will do, and fills in what is missing', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { roomNumber: 214, futureShifts: 3 },
      error: null,
    } as never);

    await expect(getOffboardingPreview('u1')).resolves.toEqual({
      roomNumber: 214,
      futureShifts: 3,
      openSwaps: 0,
      waitingRomslipp: 0,
      openReports: 0,
      roleReset: null,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('offboarding_preview', { p_user_id: 'u1' });
  });

  it('plans and cancels a move-out, with a blank reason sent as nothing', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await planMoveOut('u1', '2099-06-30', '  ');
    await planMoveOut('u1', '2099-06-30', ' Ferdig ');
    await cancelMoveOut('u1');

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'plan_move_out', {
      p_user_id: 'u1',
      p_date: '2099-06-30',
      p_reason: null,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'plan_move_out', {
      p_user_id: 'u1',
      p_date: '2099-06-30',
      p_reason: 'Ferdig',
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(3, 'cancel_move_out', { p_user_id: 'u1' });
  });

  it('keeps the database’s own message when it refuses', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Utflyttingsdatoen må være frem i tid' },
    } as never);

    await expect(planMoveOut('u1', '2000-01-01')).rejects.toThrow(
      'Utflyttingsdatoen må være frem i tid'
    );
  });

  it('maps the history, newest first, with who did it', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      eventsQuery({
        data: [
          {
            id: 'e1',
            kind: 'moved_out',
            reason: 'Ferdig',
            details: { shiftsReleased: 2 },
            created_at: '2026-10-25T10:00:00.000Z',
            actor: { name: 'Rita Romsjef' },
          },
          {
            id: 'e2',
            kind: 'added',
            reason: null,
            details: null,
            created_at: '2025-08-01T10:00:00.000Z',
            actor: null,
          },
        ],
      }) as never
    );

    const events = await getResidentEvents('u1');

    expect(events).toEqual([
      {
        id: 'e1',
        kind: 'moved_out',
        actorName: 'Rita Romsjef',
        reason: 'Ferdig',
        details: { shiftsReleased: 2 },
        createdAt: new Date('2026-10-25T10:00:00.000Z'),
      },
      {
        id: 'e2',
        kind: 'added',
        actorName: null,
        reason: null,
        details: {},
        createdAt: new Date('2025-08-01T10:00:00.000Z'),
      },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('resident_events');
  });

  it('fails clearly when the history cannot be read', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      eventsQuery({ error: { message: 'permission denied' } }) as never
    );

    await expect(getResidentEvents('u1')).rejects.toThrow('Could not get the history');
  });
});
