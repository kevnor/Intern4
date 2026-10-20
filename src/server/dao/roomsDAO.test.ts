import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignResidentToRoom,
  getResidentsForRooms,
  getRoomHistory,
  getRooms,
  getUserRoomHistory,
  setHusfar,
  setRoomTypes,
  updateRoomType,
} from './roomsDAO';
import { supabase } from '../supabaseClient';

// The setup file replaces this module for component tests; here the real one is under test.
vi.unmock('./roomsDAO');
vi.mock('../supabaseClient', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

// A chainable stand-in for the query builder that resolves to `result` when awaited.
const builder = (result: { data?: unknown; error?: { message: string } | null }) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'is', 'eq', 'update', 'gte', 'lte']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  return chain;
};

describe('roomsDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines rooms with who lives in them and derives capacity from the type', async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'rooms'
        ? builder({
            data: [
              { id: 'r1', number: 101, type: null },
              { id: 'r2', number: 150, type: 'liten_parhybel' },
              { id: 'r3', number: 151, type: 'ukjent-type' },
            ],
          })
        : builder({
            data: [
              { room_id: 'r2', user_id: 'b', moved_in: '2026-08-01', users: { name: 'Bo' } },
              { room_id: 'r2', user_id: 'a', moved_in: '2026-02-15', users: [{ name: 'Anne' }] },
            ],
          })) as never);

    const rooms = await getRooms();

    expect(rooms.map((room) => [room.number, room.type, room.capacity])).toEqual([
      [101, null, 1],
      [150, 'liten_parhybel', 2],
      [151, null, 1],
    ]);
    expect(rooms[1].occupants.map((occupant) => occupant.userName)).toEqual(['Anne', 'Bo']);
    // Dates are the calendar day, not shifted through UTC.
    expect(rooms[1].occupants[1].movedIn).toEqual(new Date(2026, 7, 1));
    expect(rooms[0].occupants).toEqual([]);
  });

  it('maps room history rows, with open stays having no move-out date', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      builder({
        data: [
          {
            id: 'o1',
            room_id: 'r1',
            user_id: 'a',
            moved_in: '2026-08-01',
            moved_out: null,
            rooms: { number: 101 },
            users: { name: 'Anne' },
          },
          {
            id: 'o2',
            room_id: 'r1',
            user_id: 'b',
            moved_in: '2025-08-01',
            moved_out: '2026-06-15',
            rooms: [{ number: 101 }],
            users: null,
          },
        ],
      }) as never
    );

    const history = await getRoomHistory('r1');

    expect(history[0]).toMatchObject({ roomNumber: 101, userName: 'Anne', movedOut: null });
    expect(history[1]).toMatchObject({ userName: 'Ukjent', movedOut: new Date(2026, 5, 15) });
  });

  it('reads a resident’s history by user id', async () => {
    const chain = builder({ data: [] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await getUserRoomHistory('a');

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'a');
  });

  it('throws a readable error when a query fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      builder({ error: { message: 'permission denied' } }) as never
    );

    await expect(getRooms()).rejects.toThrow('Could not get rooms: permission denied');
  });

  it('assigns a room through the database function and surfaces its message', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: null } as never);
    await assignResidentToRoom('a', 'r1');
    expect(supabase.rpc).toHaveBeenCalledWith('assign_resident_to_room', {
      p_user_id: 'a',
      p_room_id: 'r1',
    });

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      error: { message: 'Rommet er fullt' },
    } as never);
    await expect(assignResidentToRoom('a', 'r2')).rejects.toThrow('Rommet er fullt');
  });

  it('sets the type of one room and notices when row-level security blocked it', async () => {
    const chain = builder({ data: [{ id: 'r1' }] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await updateRoomType('r1', 'korrhybel');
    expect(chain.update).toHaveBeenCalledWith({ type: 'korrhybel' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1');

    vi.mocked(supabase.from).mockReturnValue(builder({ data: [] }) as never);
    await expect(updateRoomType('r1', null)).rejects.toThrow('Du har ikke tilgang');
  });

  it('sets a type on a whole range and returns how many rooms changed', async () => {
    const chain = builder({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const count = await setRoomTypes(100, 102, 'bottekott');

    expect(count).toBe(3);
    expect(chain.gte).toHaveBeenCalledWith('number', 100);
    expect(chain.lte).toHaveBeenCalledWith('number', 102);
    expect(chain.update).toHaveBeenCalledWith({ type: 'bottekott' });
  });

  it('maps active residents with their room and Husfar flag', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      builder({
        data: [
          { id: 'a', name: 'Anne', room_number: 101, is_husfar: false },
          { id: 'b', name: null, room_number: null, is_husfar: null },
        ],
      }) as never
    );

    expect(await getResidentsForRooms()).toEqual([
      { id: 'a', name: 'Anne', roomNumber: 101, isHusfar: false },
      { id: 'b', name: 'Ukjent', roomNumber: 0, isHusfar: false },
    ]);
  });

  it('sets the Husfar through the database function and surfaces its message', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: null } as never);
    await setHusfar('a', true);
    expect(supabase.rpc).toHaveBeenCalledWith('set_husfar', { p_user_id: 'a', p_is_husfar: true });

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      error: { message: 'Husfarhybelen er opptatt av Bo. Flytt dem først' },
    } as never);
    await expect(setHusfar('b', true)).rejects.toThrow('Husfarhybelen er opptatt');
  });
});
