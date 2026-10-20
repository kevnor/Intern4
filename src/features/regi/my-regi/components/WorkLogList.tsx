import React, { useMemo, useState } from 'react';
import { Calendar, Clock, ImageIcon, Trash2 } from 'lucide-react';
import { RegiLogWithId, WorkStatus } from '../../../../shared/types/regi';
import {
  Button,
  CategoryBadge,
  ConfirmDialog,
  DataTable,
  EmptyState,
  SegmentedControl,
  Skeleton,
  StatusMessage,
  WorkStatusBadge,
} from '../../../../shared/components';
import { formatDate, formatHours } from '../../../../shared/utils/date';
import { getSemesterName, getSemesterStart } from '../../../../shared/utils/semester';
import WorkLogDetailsModal from './WorkLogDetailsModal';

type StatusFilter = 'all' | WorkStatus;

type WorkLogListProps = {
  logs: RegiLogWithId[];
  loading?: boolean;
  error?: string | null;
  deletingId?: string | null;
  onDelete: (log: RegiLogWithId) => Promise<boolean>;
  categoryColors?: Record<string, string>;
  // Show one section per semester with its approved total.
  groupBySemester?: boolean;
};

export const canDeleteLog = (log: RegiLogWithId) =>
  log.status === 'pending' && log.sourceType === 'misc';

const imageCount = (log: RegiLogWithId) => log.imagePaths?.length ?? 0;

const WorkLogList: React.FC<WorkLogListProps> = ({
  logs,
  loading = false,
  error,
  deletingId,
  onDelete,
  categoryColors = {},
  groupBySemester = false,
}) => {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedLog, setSelectedLog] = useState<RegiLogWithId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RegiLogWithId | null>(null);

  const counts = useMemo(
    () => ({
      all: logs.length,
      pending: logs.filter((log) => log.status === 'pending').length,
      approved: logs.filter((log) => log.status === 'approved').length,
      rejected: logs.filter((log) => log.status === 'rejected').length,
    }),
    [logs]
  );
  const visibleLogs = useMemo(
    () => (filter === 'all' ? logs : logs.filter((log) => log.status === filter)),
    [filter, logs]
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const log = pendingDelete;
    const deleted = await onDelete(log);
    setPendingDelete(null);
    if (deleted && selectedLog?.id === log.id) setSelectedLog(null);
  };

  const deleteButton = (log: RegiLogWithId, compact = false) =>
    canDeleteLog(log) ? (
      <Button
        variant="ghost"
        size="sm"
        loading={deletingId === log.id}
        onClick={(event) => {
          event.stopPropagation();
          setPendingDelete(log);
        }}
        aria-label={`Slett ${log.title}`}
        icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
        className="relative z-10 text-danger hover:bg-danger-subtle hover:text-danger"
      >
        {compact ? null : 'Slett'}
      </Button>
    ) : null;

  // Newest first, so groups come out in reverse chronological order.
  const semesterGroups = useMemo(() => {
    const groups: { key: string; name: string; approved: number; logs: RegiLogWithId[] }[] = [];
    visibleLogs.forEach((log) => {
      const key = getSemesterStart(log.date).toISOString();
      let group = groups.find((candidate) => candidate.key === key);
      if (!group) {
        group = { key, name: getSemesterName(log.date), approved: 0, logs: [] };
        groups.push(group);
      }
      group.logs.push(log);
      if (log.status === 'approved') group.approved += log.hours;
    });
    return groups;
  }, [visibleLogs]);

  const renderTable = (rows: RegiLogWithId[]) => (
    <DataTable
      rows={rows}
      getRowKey={(log) => log.id}
      onRowClick={setSelectedLog}
      getRowLabel={(log) => `Vis ${log.title}`}
      bareCards
      emptyMessage={
        <EmptyState title={logs.length === 0 ? 'Ingen registreringer ennå' : 'Ingen treff'}>
          {logs.length === 0
            ? 'Timene du registrerer dukker opp her.'
            : 'Ingen registreringer har denne statusen.'}
        </EmptyState>
      }
      renderCard={(log) => (
        <article className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">
              <button
                type="button"
                onClick={() => setSelectedLog(log)}
                className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
              >
                {log.title}
              </button>
            </h3>
            <WorkStatusBadge status={log.status} />
          </div>
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Utført</dt>
              <Calendar aria-hidden="true" className="h-4 w-4 text-subtle" />
              <dd>{formatDate(log.date)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Timer</dt>
              <Clock aria-hidden="true" className="h-4 w-4 text-subtle" />
              <dd>{formatHours(log.hours)}</dd>
            </div>
            {imageCount(log) > 0 && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Bilder</dt>
                <ImageIcon aria-hidden="true" className="h-4 w-4 text-subtle" />
                <dd>{imageCount(log)}</dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Type</dt>
              <dd>
                <CategoryBadge name={log.type} color={categoryColors[log.type]} />
              </dd>
            </div>
          </dl>
          {canDeleteLog(log) && <div className="mt-2 flex justify-end">{deleteButton(log)}</div>}
        </article>
      )}
      columns={[
        {
          key: 'date',
          header: 'Utført',
          className: 'whitespace-nowrap',
          render: (log) => (
            <>
              <div className="font-medium">{formatDate(log.date)}</div>
              <div className="text-xs text-subtle">Registrert {formatDate(log.createdAt)}</div>
            </>
          ),
        },
        {
          key: 'title',
          header: 'Tittel',
          render: (log) => (
            <>
              <div>{log.title}</div>
              {imageCount(log) > 0 && (
                <div className="mt-0.5 text-xs text-subtle">
                  {imageCount(log)} {imageCount(log) === 1 ? 'bilde' : 'bilder'}
                </div>
              )}
            </>
          ),
        },
        {
          key: 'hours',
          header: 'Timer',
          className: 'whitespace-nowrap',
          render: (log) => formatHours(log.hours),
        },
        {
          key: 'type',
          header: 'Type',
          render: (log) => <CategoryBadge name={log.type} color={categoryColors[log.type]} />,
        },
        {
          key: 'status',
          header: 'Status',
          render: (log) => <WorkStatusBadge status={log.status} />,
        },
        {
          key: 'actions',
          header: <span className="sr-only">Handlinger</span>,
          render: (log) => deleteButton(log, true) ?? <span className="text-subtle">—</span>,
        },
      ]}
    />
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mine registreringer</h2>
          <p className="text-sm text-muted">Nyeste først. Regisjefen godkjenner timene.</p>
        </div>
        <SegmentedControl<StatusFilter>
          label="Filtrer på status"
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-auto"
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
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 rounded-2xl md:h-14" />
          ))}
        </div>
      ) : groupBySemester && visibleLogs.length > 0 ? (
        <div className="space-y-6">
          {semesterGroups.map((group) => (
            <section key={group.key} aria-label={group.name} className="space-y-3">
              <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold">
                {group.name}
                <span className="font-normal text-muted">
                  {formatHours(group.approved)} godkjent
                </span>
              </h3>
              {renderTable(group.logs)}
            </section>
          ))}
        </div>
      ) : (
        renderTable(visibleLogs)
      )}

      <WorkLogDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onDelete={selectedLog && canDeleteLog(selectedLog) ? setPendingDelete : undefined}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Slette registreringen?"
        confirmLabel="Slett"
        tone="danger"
        loading={!!pendingDelete && deletingId === pendingDelete.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        «{pendingDelete?.title}» ({pendingDelete ? formatHours(pendingDelete.hours) : ''}) blir
        slettet, sammen med eventuelle bilder.
      </ConfirmDialog>
    </section>
  );
};

export default WorkLogList;
