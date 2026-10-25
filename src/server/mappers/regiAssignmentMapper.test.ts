import { describe, expect, it } from 'vitest';
import { toRegiLogWithId, type RegiAssignmentRow } from './regiAssignmentMapper';

const row = (rooms: unknown): RegiAssignmentRow => ({
  id: 1,
  user_uuid: 'u1',
  work_id: 5,
  hours_used: 2,
  created_at: '2026-10-01T10:00:00Z',
  performed_at: '2026-10-01',
  approved_state: 1,
  work_items: {
    title: 'Malte veggen',
    type: 'misc',
    work_categories: { name: 'Vedlikehold' },
    rooms: rooms as never,
  },
});

describe('regi assignment mapper', () => {
  it('carries the room number of work done on a room', () => {
    expect(toRegiLogWithId(row({ number: 214 }), 'u1').roomNumber).toBe(214);
    expect(toRegiLogWithId(row([{ number: 150 }]), 'u1').roomNumber).toBe(150);
  });

  it('has no room number for work that was not on a room', () => {
    expect(toRegiLogWithId(row(null), 'u1').roomNumber).toBeUndefined();
    expect(toRegiLogWithId(row({ number: null }), 'u1').roomNumber).toBeUndefined();
  });
});
