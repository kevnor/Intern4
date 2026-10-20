import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTasks } from './useTasks';
import { type Category, type Task } from '../../../shared/types/regi/tasks';

const categories: Category[] = [
  {
    id: '1',
    name: 'Generelt',
    description: 'Generelle oppgaver',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date('2026-04-10T10:00:00.000Z'),
  },
];

const task = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Basisoppgave',
  category: 'Generelt',
  description: 'Beskrivelse',
  contactPersonId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  deadline: null,
  hourEstimate: 2,
  maxParticipants: 2,
  participants: [],
  createdAt: '2026-04-10T10:00:00.000Z',
  isArchived: false,
  ...overrides,
});

describe('useTasks', () => {
  it('shows only joinable tasks in the default available filter', () => {
    const tasks: Task[] = [
      task({ id: 'available' }),
      task({
        id: 'joined',
        participants: [
          {
            assignmentId: '1',
            userId: '11111111-1111-1111-1111-111111111111',
            status: 'joined',
            joinedAt: '2026-04-10T10:00:00.000Z',
          },
        ],
      }),
      task({
        id: 'full',
        participants: [
          {
            assignmentId: '2',
            userId: '22222222-2222-2222-2222-222222222222',
            status: 'joined',
            joinedAt: '2026-04-10T10:00:00.000Z',
          },
          {
            assignmentId: '3',
            userId: '33333333-3333-3333-3333-333333333333',
            status: 'joined',
            joinedAt: '2026-04-10T10:00:00.000Z',
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      useTasks(tasks, categories, '11111111-1111-1111-1111-111111111111', {}, 10)
    );

    expect(result.current.filteredTasks.map((entry) => entry.id)).toEqual(['available']);
  });

  it('keeps submitted tasks in the my tasks filter and supports contact-person search', () => {
    const tasks: Task[] = [
      task({
        id: 'submitted',
        title: 'Sett opp scene',
        contactPersonId: '99999999-9999-9999-9999-999999999999',
        participants: [
          {
            assignmentId: '1',
            userId: '11111111-1111-1111-1111-111111111111',
            status: 'submitted',
            joinedAt: '2026-04-10T10:00:00.000Z',
            hoursUsed: 4,
          },
        ],
      }),
      task({
        id: 'other',
        title: 'Flytt bord',
        contactPersonId: '88888888-8888-8888-8888-888888888888',
      }),
    ];

    const { result } = renderHook(() =>
      useTasks(
        tasks,
        categories,
        '11111111-1111-1111-1111-111111111111',
        {
          '99999999-9999-9999-9999-999999999999': 'Kari Kontakt',
          '88888888-8888-8888-8888-888888888888': 'Ola Oppgave',
        },
        10
      )
    );

    act(() => {
      result.current.setFilter('myTasks');
    });
    expect(result.current.filteredTasks.map((entry) => entry.id)).toEqual(['submitted']);

    act(() => {
      result.current.setFilter('all');
      result.current.setQuery('kari');
    });
    expect(result.current.filteredTasks.map((entry) => entry.id)).toEqual(['submitted']);
  });

  it('returns to the first page when the search or filters change', () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      task({ id: String(index), title: index === 11 ? 'Spesiell oppgave' : `Oppgave ${index}` })
    );
    const { result } = renderHook(() => useTasks(tasks, categories, 'user', {}, 5));

    act(() => result.current.nextPage());
    act(() => result.current.nextPage());
    expect(result.current.currentPage).toBe(3);

    act(() => result.current.setQuery('spesiell'));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedTasks.map((t) => t.id)).toEqual(['11']);

    act(() => result.current.setQuery(''));
    act(() => result.current.nextPage());
    act(() => result.current.setCategory('Generelt'));
    expect(result.current.currentPage).toBe(1);
  });

  it('clamps the page when the list shrinks below it', () => {
    let tasks = Array.from({ length: 12 }, (_, index) => task({ id: String(index) }));
    const { result, rerender } = renderHook(() => useTasks(tasks, categories, 'user', {}, 5));

    act(() => result.current.nextPage());
    act(() => result.current.nextPage());
    expect(result.current.currentPage).toBe(3);

    tasks = tasks.slice(0, 4);
    rerender();

    expect(result.current.totalPages).toBe(1);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(4);
  });
});
