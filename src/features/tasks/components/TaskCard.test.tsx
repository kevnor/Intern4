import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import type { Task, TaskParticipant } from '../../../shared/types/regi/tasks';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const participant = (userId: string, status: TaskParticipant['status']): TaskParticipant => ({
  assignmentId: `${userId}-${status}`,
  userId,
  status,
  joinedAt: '2026-04-10T10:00:00.000Z',
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Vaske kjøkken',
  category: 'Kjøkken',
  description: 'Benker og gulv',
  deadline: null,
  hourEstimate: 2,
  maxParticipants: 2,
  participants: [],
  createdAt: '2026-04-10T10:00:00.000Z',
  isArchived: false,
  ...overrides,
});

describe('TaskCard', () => {
  it('offers to join an open task without opening the task', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    const onOpen = vi.fn();
    render(<TaskCard task={task()} currentUserId={ME} onJoin={onJoin} onOpen={onOpen} />);

    expect(screen.getByText('0/2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Meld på' }));

    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens the task from the title', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TaskCard task={task()} currentUserId={ME} onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: 'Vaske kjøkken' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('offers to submit a joined task', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TaskCard
        task={task({ participants: [participant(ME, 'joined')] })}
        currentUserId={ME}
        onJoin={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByRole('button', { name: 'Meld på' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send inn' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the status once a task is submitted', () => {
    render(
      <TaskCard
        task={task({ participants: [participant(ME, 'submitted')] })}
        currentUserId={ME}
        onJoin={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Sendt inn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /meld på|send inn/i })).not.toBeInTheDocument();
  });

  it('marks a full task the user is not part of', () => {
    render(
      <TaskCard
        task={task({ maxParticipants: 1, participants: [participant(OTHER, 'joined')] })}
        currentUserId={ME}
        onJoin={vi.fn()}
      />
    );

    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Meld på' })).not.toBeInTheDocument();
  });

  it('flags deadlines in the next few days', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    render(<TaskCard task={task({ deadline: tomorrow })} currentUserId={ME} />);

    expect(screen.getByText('Snart frist')).toBeInTheDocument();
  });

  it('lets a rejected task be sent in again', () => {
    render(
      <TaskCard
        task={task({ participants: [participant(ME, 'rejected')] })}
        currentUserId={ME}
        onJoin={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Send inn' })).toBeInTheDocument();
  });
});
