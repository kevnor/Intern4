import { Calendar, Clock, User, Users } from 'lucide-react';
import { Badge, Button, CategoryBadge, TaskAssignmentBadge } from '../../../shared/components';
import { Task, getTaskWorkflowState } from '../../../shared/types/regi/tasks';
import { formatDeadline } from '../../../shared/utils/date';
import { cn } from '../../../shared/utils/cn';

const SOON_MS = 3 * 24 * 60 * 60 * 1000;

const isDeadlineSoon = (deadline: Task['deadline']) => {
  if (!deadline) return false;
  const time = new Date(deadline).getTime();
  return !Number.isNaN(time) && time - Date.now() < SOON_MS;
};

type TaskStatusActionProps = {
  task: Task;
  currentUserId?: string;
  onJoin?: (task: Task) => void;
  onSubmit?: (task: Task) => void;
  busy?: boolean;
  size?: 'sm' | 'md';
};

// The single status/action slot shared by the card and the desktop table.
export const TaskStatusAction = ({
  task,
  currentUserId,
  onJoin,
  onSubmit,
  busy = false,
  size = 'sm',
}: TaskStatusActionProps) => {
  const workflow = getTaskWorkflowState(task, currentUserId);
  const participant = workflow.currentParticipant;

  if (workflow.canJoin && onJoin) {
    return (
      <Button
        size={size}
        loading={busy}
        onClick={(event) => {
          event.stopPropagation();
          onJoin(task);
        }}
        className="relative z-10"
      >
        Meld på
      </Button>
    );
  }

  // Joined tasks can be sent in, and rejected ones sent in again.
  if (workflow.canSubmitCompletion && onSubmit) {
    return (
      <Button
        size={size}
        variant="secondary"
        loading={busy}
        onClick={(event) => {
          event.stopPropagation();
          onSubmit(task);
        }}
        className="relative z-10"
      >
        Send inn
      </Button>
    );
  }

  if (participant) return <TaskAssignmentBadge status={participant.status} />;
  if (workflow.isFull) return <Badge tone="neutral">Full</Badge>;
  return null;
};

export const ParticipantMeter = ({ task }: { task: Task }) => {
  const count = task.participants.length;
  const ratio = task.maxParticipants > 0 ? Math.min(count / task.maxParticipants, 1) : 0;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">
        {count}/{task.maxParticipants}
      </span>
      <span aria-hidden="true" className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-muted">
        <span
          className={cn('block h-full rounded-full', ratio >= 1 ? 'bg-subtle' : 'bg-primary')}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
    </span>
  );
};

type TaskCardProps = Omit<TaskStatusActionProps, 'size'> & {
  categoryColor?: string;
  contactName?: string;
  onOpen?: (task: Task) => void;
  className?: string;
};

export const TaskCard = ({
  task,
  categoryColor,
  contactName,
  onOpen,
  className,
  ...actionProps
}: TaskCardProps) => {
  const soon = isDeadlineSoon(task.deadline);

  return (
    <article
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 pl-5 shadow-sm transition-colors',
        onOpen && 'hover:border-border-strong',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-subtle"
        style={categoryColor ? { backgroundColor: categoryColor } : undefined}
      />

      <div className="flex items-start justify-between gap-3">
        <CategoryBadge name={task.category} color={categoryColor} />
        {soon && task.deadline && <Badge tone="warning">Snart frist</Badge>}
      </div>

      <h3 className="mt-2 font-semibold text-fg">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(task)}
            className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
          >
            {task.title}
          </button>
        ) : (
          task.title
        )}
      </h3>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted">{task.description}</p>
      )}

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Frist</dt>
          <Calendar aria-hidden="true" className="h-4 w-4 text-subtle" />
          <dd className={cn(soon && 'font-medium text-warning-subtle-fg')}>
            {formatDeadline(task.deadline)}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Timer</dt>
          <Clock aria-hidden="true" className="h-4 w-4 text-subtle" />
          <dd>{task.hourEstimate ? `${task.hourEstimate} t` : '–'}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Deltakere</dt>
          <Users aria-hidden="true" className="h-4 w-4 text-subtle" />
          <dd>
            <ParticipantMeter task={task} />
          </dd>
        </div>
        {contactName && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Kontaktperson</dt>
            <User aria-hidden="true" className="h-4 w-4 text-subtle" />
            <dd className="truncate">{contactName}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex items-center justify-end pt-3 empty:hidden">
        <TaskStatusAction task={task} {...actionProps} />
      </div>
    </article>
  );
};
