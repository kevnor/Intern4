import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoomReport,
  getRoomReports,
  linkReportToTask,
  setReportStatus,
  withdrawRoomReport,
} from './roomReportsDAO';
import { supabase } from '../supabaseClient';

// The setup file replaces this module for component tests; here the real one is under test.
vi.unmock('./roomReportsDAO');
vi.mock('../supabaseClient', () => ({ supabase: { from: vi.fn() } }));

// A chainable stand-in for the query builder that resolves to `result` when awaited.
const builder = (result: { data?: unknown; error?: { message: string } | null }) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'eq', 'update', 'insert', 'delete']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  return chain;
};

describe('roomReportsDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps reports with the room number, reporter and linked task', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      builder({
        data: [
          {
            id: 'a',
            room_id: 'r1',
            reported_by: 'u1',
            title: 'Lås',
            description: 'Går ikke i lås',
            status: 'task_created',
            work_item_id: 42,
            created_at: '2026-10-01T10:00:00Z',
            resolved_at: null,
            rooms: { number: 214 },
            users: [{ name: 'Anne' }],
          },
          {
            id: 'b',
            room_id: 'r2',
            reported_by: 'u2',
            title: 'Vindu',
            description: null,
            status: 'resolved',
            work_item_id: null,
            created_at: '2026-09-01T10:00:00Z',
            resolved_at: '2026-09-05T10:00:00Z',
            rooms: null,
            users: null,
          },
        ],
      }) as never
    );

    const reports = await getRoomReports();

    expect(reports[0]).toMatchObject({
      roomNumber: 214,
      reporterName: 'Anne',
      workItemId: '42',
      status: 'task_created',
    });
    expect(reports[1]).toMatchObject({ roomNumber: 0, reporterName: 'Ukjent', workItemId: null });
    expect(reports[1].resolvedAt).toEqual(new Date('2026-09-05T10:00:00Z'));
  });

  it('limits the query to one room when asked', async () => {
    const chain = builder({ data: [] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await getRoomReports('room-1');

    expect(chain.eq).toHaveBeenCalledWith('room_id', 'room-1');
  });

  it('creates a report with trimmed text and no empty description', async () => {
    const chain = builder({});
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await createRoomReport({ roomId: 'r1', reportedBy: 'u1', title: '  Lås  ', description: '  ' });

    expect(chain.insert).toHaveBeenCalledWith({
      room_id: 'r1',
      reported_by: 'u1',
      title: 'Lås',
      description: null,
    });
  });

  it('changes status and notices when row-level security blocked it', async () => {
    const chain = builder({ data: [{ id: 'a' }] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await setReportStatus('a', 'resolved');
    expect(chain.update).toHaveBeenCalledWith({ status: 'resolved' });

    vi.mocked(supabase.from).mockReturnValue(builder({ data: [] }) as never);
    await expect(setReportStatus('a', 'resolved')).rejects.toThrow('Du har ikke tilgang');
  });

  it('links a report to the task made from it', async () => {
    const chain = builder({ data: [{ id: 'a' }] });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await linkReportToTask('a', '42');

    expect(chain.update).toHaveBeenCalledWith({ status: 'task_created', work_item_id: 42 });
  });

  it('withdraws a report, and explains when it can no longer be withdrawn', async () => {
    vi.mocked(supabase.from).mockReturnValue(builder({ data: [{ id: 'a' }] }) as never);
    await withdrawRoomReport('a');

    vi.mocked(supabase.from).mockReturnValue(builder({ data: [] }) as never);
    await expect(withdrawRoomReport('a')).rejects.toThrow('kan ikke trekkes tilbake');
  });
});
