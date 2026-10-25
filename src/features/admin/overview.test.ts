import { describe, expect, it } from 'vitest';
import { plannedMoveOuts, summarizeAdmin } from './overview';
import type { Room, RoomReport } from '../rooms/types';
import type { ResidentDirectoryUser } from '../../shared/types/user';

const resident = (id: string, overrides: Partial<ResidentDirectoryUser> = {}) =>
  ({
    id,
    name: id,
    email: '',
    phone: '',
    birthDate: null,
    study: '',
    studyPlace: '',
    seniority: 0,
    roomNumber: 101,
    createdAt: null,
    onLeave: false,
    isActive: true,
    address: { street: '', postalCode: '', city: '' },
    ...overrides,
  }) as ResidentDirectoryUser;

const room = (capacity: number, occupants: number): Room => ({
  id: `r${capacity}${occupants}`,
  number: 1,
  type: null,
  capacity,
  occupants: Array.from({ length: occupants }, (_, index) => ({
    userId: `u${index}`,
    userName: 'x',
    movedIn: new Date(),
  })),
});

const report = (status: RoomReport['status']) => ({ status }) as RoomReport;

describe('summarizeAdmin', () => {
  it('counts what needs a look', () => {
    const overview = summarizeAdmin({
      residents: [
        resident('a'),
        resident('b', { onLeave: true }),
        resident('c', { roomNumber: 0 }),
        resident('d', { roomNumber: null as unknown as number, moveOutDate: '2099-06-30' }),
        resident('gone', { isActive: false, roomNumber: 0, moveOutDate: '2099-01-01' }),
      ],
      rooms: [room(1, 1), room(2, 1), room(2, 0), room(1, 2)],
      reports: [report('open'), report('task_created'), report('resolved'), report('dismissed')],
      pendingApprovals: 7,
    });

    expect(overview).toEqual({
      activeResidents: 4,
      onLeave: 1,
      withoutRoom: 2,
      plannedMoveOuts: 1,
      // 0 + 1 + 2 + 0: a room over capacity never counts as negative.
      freePlaces: 3,
      openReports: 2,
      pendingApprovals: 7,
    });
  });

  it('says unknown, not zero, for a source that could not be read', () => {
    const overview = summarizeAdmin({ residents: [resident('a')] });

    expect(overview.activeResidents).toBe(1);
    expect(overview.freePlaces).toBeNull();
    expect(overview.openReports).toBeNull();
    expect(overview.pendingApprovals).toBeNull();
    expect(summarizeAdmin({}).activeResidents).toBeNull();
  });

  it('knows an empty list from a missing one', () => {
    const overview = summarizeAdmin({ residents: [], rooms: [], reports: [], pendingApprovals: 0 });

    expect(Object.values(overview)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('plannedMoveOuts', () => {
  it('lists only active residents with a date, soonest first', () => {
    const list = plannedMoveOuts([
      resident('late', { moveOutDate: '2099-12-01' }),
      resident('none'),
      resident('soon', { moveOutDate: '2099-01-15' }),
      resident('gone', { isActive: false, moveOutDate: '2099-01-01' }),
    ]);

    expect(list.map((r) => r.id)).toEqual(['soon', 'late']);
  });
});
