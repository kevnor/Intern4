import { describe, expect, it } from 'vitest';
import {
  canCreateTaskFromReport,
  canHandleReports,
  filterReports,
  isActiveReport,
  sortReports,
  taskDraftFromReport,
} from './reports';
import type { RoomReport } from './types';

const report = (overrides: Partial<RoomReport>): RoomReport => ({
  id: 'r1',
  roomId: 'room',
  roomNumber: 214,
  reportedBy: 'u1',
  reporterName: 'Anne Hansen',
  title: 'Ødelagt lås',
  description: null,
  status: 'open',
  workItemId: null,
  createdAt: new Date(2026, 9, 1),
  resolvedAt: null,
  ...overrides,
});

describe('permissions', () => {
  it('lets Admin, Data, Regisjef and Romsjef handle reports', () => {
    for (const role of ['Admin', 'Data', 'Regisjef', 'Romsjef']) {
      expect(canHandleReports(role)).toBe(true);
    }
    expect(canHandleReports('Halv/Halv')).toBe(false);
    expect(canHandleReports(undefined)).toBe(false);
  });

  it('lets only task managers turn a report into a task', () => {
    expect(canCreateTaskFromReport('Regisjef')).toBe(true);
    expect(canCreateTaskFromReport('Admin')).toBe(true);
    expect(canCreateTaskFromReport('Romsjef')).toBe(false);
  });
});

describe('isActiveReport', () => {
  it('counts open reports and reports waiting for a task', () => {
    expect(isActiveReport(report({ status: 'open' }))).toBe(true);
    expect(isActiveReport(report({ status: 'task_created' }))).toBe(true);
    expect(isActiveReport(report({ status: 'resolved' }))).toBe(false);
    expect(isActiveReport(report({ status: 'dismissed' }))).toBe(false);
  });
});

describe('sortReports and filterReports', () => {
  const reports = [
    report({ id: 'done-new', status: 'resolved', createdAt: new Date(2026, 9, 10) }),
    report({ id: 'open-new', createdAt: new Date(2026, 9, 8) }),
    report({ id: 'done-old', status: 'dismissed', createdAt: new Date(2026, 8, 1) }),
    report({ id: 'open-old', status: 'task_created', createdAt: new Date(2026, 9, 2) }),
  ];

  it('puts active reports first, oldest first, then the finished ones, newest first', () => {
    expect(sortReports(reports).map((r) => r.id)).toEqual([
      'open-old',
      'open-new',
      'done-new',
      'done-old',
    ]);
  });

  it('can show only the active ones', () => {
    expect(filterReports(reports, 'active').map((r) => r.id)).toEqual(['open-old', 'open-new']);
    expect(filterReports(reports, 'all')).toHaveLength(4);
  });
});

describe('taskDraftFromReport', () => {
  it('prefixes the room and credits the reporter', () => {
    const draft = taskDraftFromReport(report({ description: 'Døra går ikke i lås.' }));

    expect(draft.title).toBe('Rom 214: Ødelagt lås');
    expect(draft.description).toBe('Døra går ikke i lås.\n\nMeldt av Anne Hansen (rom 214).');
  });

  it('works without a description', () => {
    expect(taskDraftFromReport(report({})).description).toBe('Meldt av Anne Hansen (rom 214).');
  });
});
