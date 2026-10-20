import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, MessageSquare, Plus, Search } from 'lucide-react';
import { useRegiHub } from './RegiHubContext';
import { getRegiTodo, getSuggestedTasks, summarizeSemesterRegi } from '../regiSummary';
import { REGI_PATHS } from '../paths';
import { useSemesterHours } from '../hooks/useSemesterHours';
import { TaskCard } from '../../tasks/components/TaskCard';
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  WorkStatusBadge,
  buttonClasses,
} from '../../../shared/components';
import { formatDate, formatHours } from '../../../shared/utils/date';
import { cn } from '../../../shared/utils/cn';

const SeeAll = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'text-primary' })}
  >
    {label}
    <ArrowRight aria-hidden="true" className="h-4 w-4" />
  </Link>
);

const OverviewTab = () => {
  const { user, isManager, logs, tasks, taskActions, approvals, categoryColors, openRegister } =
    useRegiHub();

  const { totalHours } = useSemesterHours();
  const summary = useMemo(
    () => summarizeSemesterRegi(logs.logs, user.role, new Date(), totalHours),
    [logs.logs, user.role, totalHours]
  );
  const todo = useMemo(
    () => getRegiTodo(logs.logs, tasks.tasks, user.id),
    [logs.logs, tasks.tasks, user.id]
  );
  const suggested = useMemo(() => getSuggestedTasks(tasks.tasks, user.id), [tasks.tasks, user.id]);
  const recent = logs.logs.slice(0, 5);
  const progress = summary.required > 0 ? Math.min(summary.approved / summary.required, 1) : 1;
  const pendingApprovals = approvals.approvals.length;

  const cardProps = (task: (typeof suggested)[number]) => ({
    task,
    currentUserId: user.id,
    categoryColor: categoryColors[task.category],
    contactName: task.contactPersonId ? tasks.participantNames[task.contactPersonId] : undefined,
    onOpen: tasks.setSelectedTask,
    onJoin: (target: typeof task) => taskActions.join(target.id),
    onSubmit: taskActions.requestSubmit,
    busy: taskActions.busyTaskId === task.id,
  });

  return (
    <div className="space-y-6">
      <Card>
        {logs.loading ? (
          <Skeleton className="h-28" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted">Godkjent dette semesteret</p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatHours(summary.approved)}
                  {summary.required > 0 && (
                    <span className="text-lg font-medium text-subtle">
                      {' '}
                      / {formatHours(summary.required)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-muted">Venter</p>
                  <p className="font-semibold tabular-nums">{formatHours(summary.pending)}</p>
                </div>
                <div>
                  <p className="text-muted">Gjenstår</p>
                  <p className="font-semibold tabular-nums">
                    {summary.required > 0 ? formatHours(summary.remaining) : 'Ingen krav'}
                  </p>
                </div>
              </div>
            </div>
            {summary.required > 0 && (
              <div
                role="meter"
                aria-label="Godkjente timer av kravet"
                aria-valuemin={0}
                aria-valuemax={summary.required}
                aria-valuenow={Math.min(summary.approved, summary.required)}
                className="h-3 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width]',
                    progress >= 1 ? 'bg-success' : 'bg-primary'
                  )}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={openRegister}>
                Registrer timer
              </Button>
              <Link to={REGI_PATHS.OPPGAVER} className={buttonClasses({ variant: 'secondary' })}>
                <Search aria-hidden="true" className="h-4 w-4" />
                Finn oppgave
              </Link>
            </div>
          </div>
        )}
      </Card>

      {(todo.count > 0 || (isManager && pendingApprovals > 0)) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Trenger handling</h2>
          {isManager && pendingApprovals > 0 && (
            <Link
              to={REGI_PATHS.GODKJENNING}
              className="flex items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary-subtle p-4 font-semibold text-primary-subtle-fg hover:border-primary/50"
            >
              <span className="flex items-center gap-3">
                <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
                {pendingApprovals} venter på godkjenning
              </span>
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {todo.tasksToSubmit.map((task) => (
              <li key={task.id}>
                <TaskCard {...cardProps(task)} />
              </li>
            ))}
            {todo.rejectedEntries.map((log) => (
              <li
                key={log.id}
                className="rounded-2xl border border-danger-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{log.title}</p>
                  <WorkStatusBadge status={log.status} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(log.date)} · {formatHours(log.hours)}
                </p>
                {log.reviewerComment && (
                  <p className="mt-2 flex items-start gap-2 text-sm">
                    <MessageSquare
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-subtle"
                    />
                    {log.reviewerComment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Siste registreringer</h2>
            <SeeAll to={REGI_PATHS.TIMER} label="Mine timer" />
          </div>
          {logs.loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : recent.length === 0 ? (
            <EmptyState title="Ingen registreringer ennå">
              Registrer timer eller meld deg på en oppgave for å komme i gang.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
              {recent.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{log.title}</p>
                    <p className="text-sm text-muted">
                      {formatDate(log.date)} · {formatHours(log.hours)}
                    </p>
                  </div>
                  <WorkStatusBadge status={log.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ledige oppgaver</h2>
            <SeeAll to={REGI_PATHS.OPPGAVER} label="Alle oppgaver" />
          </div>
          {tasks.loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : suggested.length === 0 ? (
            <EmptyState title="Ingen ledige oppgaver akkurat nå">
              Sjekk igjen senere, eller registrer annet arbeid du har gjort.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {suggested.map((task) => (
                <li key={task.id}>
                  <TaskCard {...cardProps(task)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default OverviewTab;
