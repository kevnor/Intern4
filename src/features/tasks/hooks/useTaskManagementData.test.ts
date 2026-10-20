import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTaskManagementData } from './useTaskManagementData';
import { getUserNames } from '../../../server/dao/userDAO';
import type { Task } from '../../../shared/types/regi/tasks';

const ACTIVE = '11111111-1111-4111-8111-111111111111';
const FORMER = '22222222-2222-4222-8222-222222222222';

const task: Task = {
  id: 't1',
  title: 'Male gang',
  category: 'Regi',
  deadline: null,
  hourEstimate: 2,
  maxParticipants: 3,
  participants: [
    { assignmentId: 'a1', userId: ACTIVE, status: 'joined', joinedAt: '2026-09-01T10:00:00.000Z' },
    { assignmentId: 'a2', userId: FORMER, status: 'joined', joinedAt: '2026-09-01T10:00:00.000Z' },
  ],
  createdAt: '2026-09-01T10:00:00.000Z',
  isArchived: false,
};

vi.mock('../../../server/dao/tasksDAO', () => ({ getTasks: vi.fn(async () => [task]) }));
vi.mock('../../../server/dao/categoriesDAO', () => ({ getCategories: vi.fn(async () => []) }));
vi.mock('../../../server/dao/userDAO', () => ({
  getActiveUsersWithRole: vi.fn(async () => [
    { id: ACTIVE, name: 'Aktiv Beboer', email: 'a@x.no', role: 'Halv/Halv' },
  ]),
  getUserNames: vi.fn(async () => ({ [FORMER]: 'Tidligere Beboer' })),
}));

describe('useTaskManagementData', () => {
  it('looks up only names that the active-user list does not have', async () => {
    const { result } = renderHook(() => useTaskManagementData());

    await waitFor(() =>
      expect(result.current.participantNames).toEqual({
        [ACTIVE]: 'Aktiv Beboer',
        [FORMER]: 'Tidligere Beboer',
      })
    );
    expect(getUserNames).toHaveBeenCalledWith([FORMER]);
  });
});
