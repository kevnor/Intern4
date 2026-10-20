import { describe, expect, it } from 'vitest';
import {
  getMyActiveTasks,
  getRegiTodo,
  getSuggestedTasks,
  summarizeSemesterRegi,
} from './regiSummary';
import type { RegiLogWithId } from '../../shared/types/regi';
import type { Task, TaskParticipant } from '../../shared/types/regi/tasks';

const ME = '11111111-1111-4111-8111-111111111111';

const log = (overrides: Partial<RegiLogWithId>): RegiLogWithId => ({
  id: '1',
  userId: ME,
  title: 'Regi',
  hours: 1,
  date: new Date(2026, 8, 1),
  createdAt: new Date(2026, 8, 1),
  sourceType: 'misc',
  status: 'approved',
  type: 'Regi',
  ...overrides,
});

const participant = (status: TaskParticipant['status']): TaskParticipant => ({
  assignmentId: `a-${status}`,
  userId: ME,
  status,
  joinedAt: '2026-09-01T10:00:00.000Z',
});

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Oppgave ${id}`,
  category: 'Regi',
  deadline: null,
  hourEstimate: 2,
  maxParticipants: 3,
  participants: [],
  createdAt: '2026-09-01T10:00:00.000Z',
  isArchived: false,
  ...overrides,
});

describe('regiSummary', () => {
  it('only counts this semester towards the requirement', () => {
    const summary = summarizeSemesterRegi(
      [
        log({ hours: 10, date: new Date(2026, 7, 15) }),
        log({ hours: 20, date: new Date(2026, 5, 1) }), // last semester
        log({ hours: 3, status: 'pending', date: new Date(2026, 8, 2) }),
        log({ hours: 5, status: 'rejected', date: new Date(2026, 8, 3) }),
      ],
      'Halv/Halv',
      new Date(2026, 9, 19)
    );

    expect(summary).toEqual({ approved: 10, pending: 3, required: 24, remaining: 14 });
  });

  it('lists my unfinished tasks with rework first', () => {
    const tasks = [
      task('submitted', { participants: [participant('submitted')] }),
      task('done', { participants: [participant('approved')] }),
      task('rejected', { participants: [participant('rejected')] }),
      task('open'),
    ];

    expect(getMyActiveTasks(tasks, ME).map((t) => t.id)).toEqual(['rejected', 'submitted']);
  });

  it('suggests at most three joinable tasks, soonest deadline first', () => {
    const tasks = [
      task('no-deadline'),
      task('late', { deadline: '2026-12-01' }),
      task('soon', { deadline: '2026-10-21' }),
      task('mine', { participants: [participant('joined')] }),
      task('archived', { isArchived: true }),
      task('mid', { deadline: '2026-11-01' }),
    ];

    expect(getSuggestedTasks(tasks, ME).map((t) => t.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('collects what needs doing: tasks to send in and rejected entries this semester', () => {
    const todo = getRegiTodo(
      [
        log({ id: 'rejected-now', status: 'rejected', date: new Date(2026, 8, 3) }),
        log({ id: 'rejected-old', status: 'rejected', date: new Date(2026, 4, 3) }),
        log({ id: 'rejected-task', status: 'rejected', sourceType: 'task' }),
        log({ id: 'pending', status: 'pending' }),
      ],
      [
        task('joined', { participants: [participant('joined')] }),
        task('rejected', { participants: [participant('rejected')] }),
        task('submitted', { participants: [participant('submitted')] }),
        task('no-estimate', { hourEstimate: null, participants: [participant('joined')] }),
      ],
      ME,
      new Date(2026, 9, 19)
    );

    expect(todo.tasksToSubmit.map((t) => t.id)).toEqual(['rejected', 'joined']);
    expect(todo.rejectedEntries.map((l) => l.id)).toEqual(['rejected-now']);
    expect(todo.count).toBe(3);
  });
});
