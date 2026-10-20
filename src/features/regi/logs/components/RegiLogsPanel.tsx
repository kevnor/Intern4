import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { RegiLogWithUser, WorkStatus } from '../../../../shared/types/regi';
import { getAllRegiLogs, getEarliestRegiDate } from '../../../../server/dao/regiDAO';
import { useAuth } from '../../../../app/providers/AuthContext';
import { canApproveWork } from '../../permissions';
import {
  Badge,
  CategoryBadge,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  StatusMessage,
  WorkStatusBadge,
} from '../../../../shared/components';
import { formatDate, formatHours } from '../../../../shared/utils/date';
import { Semester, getSemester, listSemesters } from '../../../../shared/utils/semester';

type StatusFilter = 'all' | WorkStatus;

const Decision = ({ log }: { log: RegiLogWithUser }) => {
  if (log.status === 'pending') return <span className="text-subtle">—</span>;
  return (
    <div className="min-w-0 text-sm">
      <div className="text-muted">{log.approvedByName ?? 'Ukjent'}</div>
      {log.approvalComment && (
        <div className="mt-0.5 flex items-start gap-1 text-xs text-subtle">
          <MessageSquare aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{log.approvalComment}</span>
        </div>
      )}
    </div>
  );
};

const RegiLogsPanel: React.FC<{ categoryColors?: Record<string, string> }> = ({
  categoryColors = {},
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<RegiLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  // One semester at a time keeps the list from growing with every year.
  const [semesters, setSemesters] = useState<Semester[]>(() => [getSemester()]);
  const [semesterKey, setSemesterKey] = useState(() => getSemester().key);
  const semester = semesters.find((item) => item.key === semesterKey) ?? semesters[0];

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setLogs(await getAllRegiLogs({ start: semester.start, end: semester.end }));
    } catch (e) {
      console.error(e);
      setError('Kunne ikke laste regilogger.');
    } finally {
      setLoading(false);
    }
  }, [semester.start, semester.end]);

  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (!userId || !canApproveWork(userRole)) return;
    void load();
  }, [load, userId, userRole]);

  useEffect(() => {
    if (!userId || !canApproveWork(userRole)) return;
    getEarliestRegiDate()
      .then((earliest) => {
        if (earliest) setSemesters(listSemesters(earliest));
      })
      .catch((loadError) => console.error(loadError));
  }, [userId, userRole]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.userName.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        (log.category ?? '').toLowerCase().includes(q)
    );
  }, [logs, query]);

  const counts = useMemo(
    () => ({
      all: searched.length,
      pending: searched.filter((log) => log.status === 'pending').length,
      approved: searched.filter((log) => log.status === 'approved').length,
      rejected: searched.filter((log) => log.status === 'rejected').length,
    }),
    [searched]
  );
  const rows = status === 'all' ? searched : searched.filter((log) => log.status === status);

  if (!user || !canApproveWork(user.role)) {
    return <StatusMessage tone="info">Ingen tilgang.</StatusMessage>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Søk på navn, e-post, tittel eller kategori..."
          label="Søk i regilogger"
          onRefresh={() => void load()}
          refreshing={loading}
          className="flex-1"
        />
        <div className="w-full sm:w-44">
          <Select
            aria-label="Semester"
            value={semester.key}
            onChange={(event) => setSemesterKey(event.target.value)}
          >
            {semesters.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
        <SegmentedControl<StatusFilter>
          label="Filtrer på status"
          value={status}
          onChange={setStatus}
          className="w-full overflow-x-auto lg:w-auto"
          options={[
            { value: 'all', label: `Alle (${counts.all})` },
            { value: 'pending', label: `Venter (${counts.pending})` },
            { value: 'approved', label: `Godkjent (${counts.approved})` },
            { value: 'rejected', label: `Avslått (${counts.rejected})` },
          ]}
        />
      </div>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      {loading ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Laster...</span>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24 rounded-2xl md:h-12" />
          ))}
        </div>
      ) : (
        <DataTable
          rows={rows}
          getRowKey={(log) => log.id}
          emptyMessage={<EmptyState title={`Ingen regilogger funnet for ${semester.name}.`} />}
          renderCard={(log) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{log.title}</p>
                  <p className="text-sm text-muted">
                    {log.userName} · {formatDate(log.date)}
                  </p>
                </div>
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {formatHours(log.hours)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WorkStatusBadge status={log.status} />
                <CategoryBadge name={log.category} color={categoryColors[log.category]} />
                {log.sourceType === 'task' && <Badge tone="info">Oppgave</Badge>}
              </div>
              {log.status !== 'pending' && <Decision log={log} />}
            </div>
          )}
          columns={[
            {
              key: 'user',
              header: 'Beboer',
              render: (log) => (
                <>
                  <div className="font-medium">{log.userName}</div>
                  <div className="text-xs text-subtle">{log.userEmail}</div>
                </>
              ),
            },
            {
              key: 'title',
              header: 'Tittel',
              render: (log) => (
                <div className="max-w-xs">
                  <div className="truncate">{log.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <CategoryBadge name={log.category} color={categoryColors[log.category]} />
                    {log.sourceType === 'task' && <Badge tone="info">Oppgave</Badge>}
                  </div>
                </div>
              ),
            },
            {
              key: 'hours',
              header: 'Timer',
              className: 'whitespace-nowrap tabular-nums',
              render: (log) => formatHours(log.hours),
            },
            {
              key: 'date',
              header: 'Utført',
              className: 'whitespace-nowrap',
              render: (log) => formatDate(log.date),
            },
            {
              key: 'status',
              header: 'Status',
              render: (log) => <WorkStatusBadge status={log.status} />,
            },
            { key: 'decision', header: 'Behandlet av', render: (log) => <Decision log={log} /> },
          ]}
        />
      )}
    </div>
  );
};

export default RegiLogsPanel;
