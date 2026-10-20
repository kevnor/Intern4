import type { ReactNode } from 'react';
import type { WorkStatus } from '../types/regi';
import type { TaskAssignmentStatus } from '../types/regi/tasks/task.types';
import { cn } from '../utils/cn';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted',
  primary: 'bg-primary-subtle text-primary-subtle-fg',
  accent: 'bg-accent-subtle text-accent-subtle-fg',
  success: 'bg-success-subtle text-success-subtle-fg',
  warning: 'bg-warning-subtle text-warning-subtle-fg',
  danger: 'bg-danger-subtle text-danger-subtle-fg',
  info: 'bg-info-subtle text-info-subtle-fg',
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export const Badge = ({ tone = 'neutral', children, className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
      toneClasses[tone],
      className
    )}
  >
    {children}
  </span>
);

const workStatusBadges: Record<WorkStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warning', label: 'Venter' },
  approved: { tone: 'success', label: 'Godkjent' },
  rejected: { tone: 'danger', label: 'Avslått' },
};

export const WorkStatusBadge = ({ status }: { status: WorkStatus }) => {
  const { tone, label } = workStatusBadges[status];
  return <Badge tone={tone}>{label}</Badge>;
};

const taskAssignmentBadges: Record<TaskAssignmentStatus, { tone: BadgeTone; label: string }> = {
  joined: { tone: 'info', label: 'Påmeldt' },
  submitted: { tone: 'warning', label: 'Sendt inn' },
  approved: { tone: 'success', label: 'Godkjent' },
  rejected: { tone: 'danger', label: 'Avslått' },
};

export const TaskAssignmentBadge = ({ status }: { status: TaskAssignmentStatus }) => {
  const { tone, label } = taskAssignmentBadges[status];
  return <Badge tone={tone}>{label}</Badge>;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Category colours are user-chosen, so they are shown as a dot rather than as text or fill
// colour, which keeps the badge readable in both themes.
export const CategoryBadge = ({ name, color }: { name: string; color?: string | null }) => (
  <Badge>
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-full bg-subtle"
      style={color && HEX_COLOR.test(color) ? { backgroundColor: color } : undefined}
    />
    {name}
  </Badge>
);
