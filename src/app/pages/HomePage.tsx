import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../providers/AuthContext';
import { useHomeData } from './useHomeData';
import { getRegiTodo, summarizeSemesterRegi } from '../../features/regi/regiSummary';
import { useSemesterHours } from '../../features/regi/hooks/useSemesterHours';
import { useVaktHours } from '../../features/shifts/hooks/useVaktHours';
import { VaktProgress } from '../../features/shifts/components/VaktProgress';
import { hasVakt } from '../../features/shifts/vaktSummary';
import { canApproveWork } from '../../features/regi/permissions';
import { REGI_PATHS } from '../../features/regi/paths';
import { PageLayout } from '../../shared/layouts';
import { Card, Skeleton, StatusMessage, buttonClasses } from '../../shared/components';
import { formatHours } from '../../shared/utils/date';
import { getSemesterName } from '../../shared/utils/semester';
import { cn } from '../../shared/utils/cn';

const TodoItem = ({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  detail?: string;
}) => (
  <li>
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle" />
    </Link>
  </li>
);

const HomePage = () => {
  const { user } = useAuth();
  const { logs, tasks, pendingApprovals, loading, error } = useHomeData(user);

  const userId = user?.id ?? '';
  const { totalHours } = useSemesterHours();
  const { summary: vakt, loading: vaktLoading } = useVaktHours(user?.id, user?.role, totalHours);
  const summary = useMemo(
    () => summarizeSemesterRegi(logs, user?.role, new Date(), totalHours),
    [logs, user?.role, totalHours]
  );
  const todo = useMemo(() => getRegiTodo(logs, tasks, userId), [logs, tasks, userId]);
  const showApprovals = canApproveWork(user?.role) && !!pendingApprovals;
  const firstName = user?.name?.split(' ')[0];
  const progress = summary.required > 0 ? Math.min(summary.approved / summary.required, 1) : 1;

  return (
    <PageLayout
      title={firstName ? `Hei, ${firstName}!` : 'Hei!'}
      description={`${getSemesterName()} · Her er det viktigste for deg akkurat nå.`}
    >
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Regi" description="Godkjente timer dette semesteret.">
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-bold tabular-nums">
                  {formatHours(summary.approved)}
                  {summary.required > 0 && (
                    <span className="text-lg font-medium text-subtle">
                      {' '}
                      / {formatHours(summary.required)}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {summary.required === 0
                    ? 'Ingen krav'
                    : summary.remaining === 0
                      ? 'Kravet er oppfylt'
                      : `${formatHours(summary.remaining)} igjen`}
                </p>
              </div>
              {summary.required > 0 && (
                <div
                  role="meter"
                  aria-label="Godkjente timer av kravet"
                  aria-valuemin={0}
                  aria-valuemax={summary.required}
                  aria-valuenow={Math.min(summary.approved, summary.required)}
                  className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      progress >= 1 ? 'bg-success' : 'bg-primary'
                    )}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
              {summary.pending > 0 && (
                <p className="text-sm text-muted">
                  {formatHours(summary.pending)} venter på godkjenning.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to={`${REGI_PATHS.REGI}?registrer=1`} className={buttonClasses()}>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Registrer timer
                </Link>
                <Link to={REGI_PATHS.OPPGAVER} className={buttonClasses({ variant: 'secondary' })}>
                  <Search aria-hidden="true" className="h-4 w-4" />
                  Finn oppgave
                </Link>
              </div>
            </div>
          )}
        </Card>

        {hasVakt(vakt) && (
          <Card title="Vakt" description="Fullførte vakter dette semesteret.">
            {vaktLoading ? <Skeleton className="h-24" /> : <VaktProgress summary={vakt} showLink />}
          </Card>
        )}

        <Card title="Å gjøre" bodyClassName="p-0 sm:p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-24" />
            </div>
          ) : todo.count === 0 && !showApprovals ? (
            <p className="flex items-center gap-3 px-4 py-6 text-sm text-muted sm:px-5">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-success" />
              Ingenting venter på deg akkurat nå.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {showApprovals && (
                <TodoItem
                  to={REGI_PATHS.GODKJENNING}
                  icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
                  title={`${pendingApprovals} venter på godkjenning`}
                  detail="Gå til godkjenningslisten"
                />
              )}
              {todo.tasksToSubmit.map((task) => (
                <TodoItem
                  key={task.id}
                  to={REGI_PATHS.REGI}
                  icon={<Send className="h-5 w-5 text-info" />}
                  title={`Send inn «${task.title}»`}
                  detail="Ferdig med oppgaven? Send den til godkjenning."
                />
              ))}
              {todo.rejectedEntries.map((log) => (
                <TodoItem
                  key={log.id}
                  to={REGI_PATHS.TIMER}
                  icon={<XCircle className="h-5 w-5 text-danger" />}
                  title={`«${log.title}» ble avslått`}
                  detail={log.reviewerComment ?? 'Se registreringen'}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

export default HomePage;
