import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../../app/providers/AuthContext';
import { canApproveWork } from '../../permissions';
import { USER_ROLES } from '../../../../shared/types/roles';
import SemesterHoursCard from './SemesterHoursCard';
import { RegistatusRow, useRegistatus } from '../hooks/useRegistatus';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedControl,
  Skeleton,
  StatusMessage,
} from '../../../../shared/components';
import { formatHours } from '../../../../shared/utils/date';
import { cn } from '../../../../shared/utils/cn';

type RowStatus = 'missing' | 'done' | 'leave' | 'exempt';
type StatusFilter = 'all' | RowStatus;

export const getRowStatus = (row: RegistatusRow): RowStatus =>
  row.onLeave
    ? 'leave'
    : row.requiredHours === 0
      ? 'exempt'
      : row.remainingHours > 0
        ? 'missing'
        : 'done';

const StatusBadge = ({ row }: { row: RegistatusRow }) => {
  const status = getRowStatus(row);
  if (status === 'leave') return <Badge tone="warning">Permisjon</Badge>;
  if (status === 'missing') return <Badge tone="danger">Mangler timer</Badge>;
  if (status === 'exempt') return <Badge>Ingen krav</Badge>;
  return <Badge tone="success">Oppfylt</Badge>;
};

const ProgressMeter = ({ row }: { row: RegistatusRow }) => {
  if (row.requiredHours === 0) {
    return <span className="text-sm text-subtle">{formatHours(row.approvedHours)} godkjent</span>;
  }
  const ratio = row.requiredHours > 0 ? Math.min(row.approvedHours / row.requiredHours, 1) : 1;
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={`${row.name}: ${formatHours(row.approvedHours)} av ${formatHours(row.requiredHours)}`}
        aria-valuemin={0}
        aria-valuemax={row.requiredHours}
        aria-valuenow={Math.min(row.approvedHours, row.requiredHours)}
        className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn('h-full rounded-full', ratio >= 1 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-sm tabular-nums">
        {formatHours(row.approvedHours)}
        <span className="text-subtle"> / {formatHours(row.requiredHours)}</span>
      </span>
    </div>
  );
};

type RegistatusProps = {
  // Opens "Gi regi" prefilled with this resident.
  onGrant?: (row: RegistatusRow) => void;
};

const Registatus: React.FC<RegistatusProps> = ({ onGrant }) => {
  const { user, loading: authLoading } = useAuth();
  const { semesterLabel, filtered, loading, error, query, setQuery, load } = useRegistatus(
    user,
    authLoading
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => {
    const result = { all: filtered.length, missing: 0, done: 0, leave: 0, exempt: 0 };
    filtered.forEach((row) => (result[getRowStatus(row)] += 1));
    return result;
  }, [filtered]);

  const rows =
    statusFilter === 'all'
      ? filtered
      : filtered.filter((row) => getRowStatus(row) === statusFilter);

  const grantButton = (row: RegistatusRow) =>
    onGrant ? (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onGrant(row)}
        aria-label={`Gi timer til ${row.name}`}
        icon={<Plus aria-hidden="true" className="h-4 w-4" />}
      >
        Gi timer
      </Button>
    ) : null;

  if (authLoading) return null;
  if (!user || !canApproveWork(user.role)) {
    return <StatusMessage tone="info">Du har ikke tilgang til registatus.</StatusMessage>;
  }

  return (
    <div className="space-y-4">
      {user.role === USER_ROLES.ADMIN && <SemesterHoursCard onSaved={() => void load()} />}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Søk på navn, e-post eller rolle..."
          label="Søk i registatus"
          onRefresh={() => void load()}
          refreshing={loading}
          className="flex-1"
        />
        <SegmentedControl<StatusFilter>
          label="Filtrer på status"
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-full overflow-x-auto lg:w-auto"
          options={[
            { value: 'all', label: `Alle (${counts.all})` },
            { value: 'missing', label: `Mangler (${counts.missing})` },
            { value: 'done', label: `Oppfylt (${counts.done})` },
            { value: 'leave', label: `Permisjon (${counts.leave})` },
          ]}
        />
      </div>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <p className="text-sm text-muted">
        Godkjente timer siden semesterstart <span className="font-medium">{semesterLabel}</span>.
      </p>

      {loading ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Laster...</span>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20 rounded-2xl md:h-12" />
          ))}
        </div>
      ) : (
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          emptyMessage={
            <EmptyState title="Ingen nåværende beboere funnet.">
              Prøv et annet søk eller filter.
            </EmptyState>
          }
          renderCard={(row) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="text-xs text-subtle">{row.role ?? 'Uten rolle'}</p>
                </div>
                <StatusBadge row={row} />
              </div>
              <ProgressMeter row={row} />
              {getRowStatus(row) === 'missing' && (
                <p className="text-xs text-muted">Gjenstår {formatHours(row.remainingHours)}</p>
              )}
              {onGrant && <div className="pt-1">{grantButton(row)}</div>}
            </div>
          )}
          columns={[
            {
              key: 'name',
              header: 'Navn',
              render: (row) => (
                <>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-subtle">{row.email}</div>
                </>
              ),
            },
            { key: 'role', header: 'Rolle', render: (row) => row.role ?? 'Uten rolle' },
            { key: 'progress', header: 'Godkjent', render: (row) => <ProgressMeter row={row} /> },
            {
              key: 'remaining',
              header: 'Gjenstår',
              className: 'whitespace-nowrap tabular-nums',
              render: (row) => formatHours(row.remainingHours),
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge row={row} /> },
            ...(onGrant
              ? [
                  {
                    key: 'grant',
                    header: <span className="sr-only">Handlinger</span>,
                    render: grantButton,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
};

export default Registatus;
