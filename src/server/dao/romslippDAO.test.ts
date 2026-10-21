import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerRomslipp,
  cancelRomslipp,
  closeRomslipp,
  getAvailableRooms,
  getLatestRomslipp,
  getRomslippTurn,
  skipRomslipp,
  startRomslipp,
} from './romslippDAO';
import { supabase } from '../supabaseClient';

// The setup file replaces this module for component tests; here the real one is under test.
vi.unmock('./romslippDAO');
vi.mock('../supabaseClient', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

// A chainable stand-in for the query builder that resolves to `result` when awaited.
const builder = (result: { data?: unknown; error?: { message: string } | null }) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'eq', 'limit']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null, ...result }));
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  return chain;
};

const roundRow = (id: string, status: string) => ({
  id,
  semester_key: '2026-H',
  status,
  created_at: '2026-10-01T10:00:00Z',
  closed_at: status === 'open' ? null : '2026-10-05T10:00:00Z',
});

describe('romslippDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns nothing when there has never been a round', async () => {
    vi.mocked(supabase.from).mockReturnValue(builder({ data: [] }) as never);

    expect(await getLatestRomslipp()).toBeNull();
  });

  it('prefers the open round over newer finished ones and maps the participants in order', async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'romslipp_rounds'
        ? builder({ data: [roundRow('cancelled-new', 'cancelled'), roundRow('open-old', 'open')] })
        : builder({
            data: [
              {
                user_id: 'a',
                position: 1,
                status: 'moved',
                chosen_room_id: 'r273',
                answered_at: '2026-10-02T10:00:00Z',
                person: { name: 'Anne' },
                from_room: [{ number: 270 }],
                chosen_room: { number: 273 },
                answerer: { name: 'Romsjef' },
              },
              {
                user_id: 'b',
                position: 2,
                status: 'waiting',
                chosen_room_id: null,
                answered_at: null,
                person: null,
                from_room: null,
                chosen_room: null,
                answerer: null,
              },
            ],
          })) as never);

    const state = await getLatestRomslipp();

    expect(state?.round).toMatchObject({ id: 'open-old', status: 'open', closedAt: null });
    expect(state?.participants[0]).toMatchObject({
      userName: 'Anne',
      fromRoomNumber: 270,
      chosenRoomNumber: 273,
      answeredByName: 'Romsjef',
    });
    expect(state?.participants[1]).toMatchObject({
      userName: 'Ukjent',
      fromRoomNumber: null,
      chosenRoomId: null,
      answeredAt: null,
    });
  });

  it('falls back to the most recent round when none is open', async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'romslipp_rounds'
        ? builder({ data: [roundRow('new', 'closed'), roundRow('old', 'cancelled')] })
        : builder({ data: [] })) as never);

    expect((await getLatestRomslipp())?.round.id).toBe('new');
  });

  it('maps the rooms that are available and ignores unknown types', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        { room_id: 'a', number: 273, type: null, free_spots: 1 },
        { room_id: 'b', number: 150, type: 'liten_parhybel', free_spots: 2 },
        { room_id: 'c', number: 151, type: 'suite', free_spots: 1 },
      ],
      error: null,
    } as never);

    const rooms = await getAvailableRooms('round');

    expect(supabase.rpc).toHaveBeenCalledWith('romslipp_available_rooms', { p_round_id: 'round' });
    expect(rooms).toEqual([
      { roomId: 'a', number: 273, type: null, freeSpots: 1 },
      { roomId: 'b', number: 150, type: 'liten_parhybel', freeSpots: 2 },
      { roomId: 'c', number: 151, type: null, freeSpots: 1 },
    ]);
  });

  it('finds who is asked next in the open round', async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'romslipp_rounds'
        ? builder({ data: { id: 'round' } })
        : builder({ data: { user_id: 'u7' } })) as never);

    expect(await getRomslippTurn()).toEqual({ roundId: 'round', userId: 'u7' });
  });

  it('has no turn when no round is open or everyone has answered', async () => {
    vi.mocked(supabase.from).mockReturnValue(builder({ data: null }) as never);
    expect(await getRomslippTurn()).toBeNull();

    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'romslipp_rounds'
        ? builder({ data: { id: 'round' } })
        : builder({ data: null })) as never);
    expect(await getRomslippTurn()).toBeNull();
  });

  it('calls the database functions with the right arguments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never);

    await startRomslipp('2026-H');
    await answerRomslipp('round', 'room');
    await answerRomslipp('round', null, 'someone');
    await skipRomslipp('round', 'someone');
    await closeRomslipp('round');
    await cancelRomslipp('round');

    expect(vi.mocked(supabase.rpc).mock.calls).toEqual([
      ['start_romslipp', { p_semester_key: '2026-H' }],
      ['romslipp_answer', { p_round_id: 'round', p_room_id: 'room', p_user_id: null }],
      ['romslipp_answer', { p_round_id: 'round', p_room_id: null, p_user_id: 'someone' }],
      ['romslipp_skip', { p_round_id: 'round', p_user_id: 'someone' }],
      ['close_romslipp', { p_round_id: 'round' }],
      ['cancel_romslipp', { p_round_id: 'round' }],
    ]);
  });

  it('surfaces the database message when an action is refused', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      error: { message: 'Det er ikke din tur' },
    } as never);

    await expect(answerRomslipp('round', 'room')).rejects.toThrow('Det er ikke din tur');
  });
});
