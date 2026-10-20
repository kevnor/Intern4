import { useState } from 'react';
import { CalendarCheck, Send, Trash2, Wand2 } from 'lucide-react';
import type { ResidentRow, useVaktAdmin } from '../hooks/useVaktAdmin';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Skeleton,
  StatTile,
  StatusMessage,
} from '../../../shared/components';
import { SHIFT_HOURS } from '../slots';
import { formatHours } from '../../../shared/utils/date';

type AdminTabProps = {
  admin: ReturnType<typeof useVaktAdmin>;
};

const getStatus = (row: ResidentRow) => {
  if (row.assignedShifts < row.targetShifts) return <Badge tone="danger">Mangler vakter</Badge>;
  if (row.assignedShifts > row.targetShifts) return <Badge tone="info">Ekstra</Badge>;
  return <Badge tone="success">Fordelt</Badge>;
};

type Confirming = 'clear' | 'publish' | null;

const AdminTab = ({ admin }: AdminTabProps) => {
  const { rows, stats, loading, busy, error, lastRun, unavailability } = admin;
  const [confirming, setConfirming] = useState<Confirming>(null);
  const empty = stats.total - stats.filled;
  const missing = rows.filter((row) => row.assignedShifts < row.targetShifts);

  if (loading) return <Skeleton className="h-64" />;

  const confirm = async () => {
    const action = confirming === 'clear' ? admin.clearDrafts : admin.publish;
    await action();
    setConfirming(null);
  };

  return (
    <div className="space-y-6">
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Fordelte vakter"
          value={`${stats.filled} / ${stats.total}`}
          hint={empty > 0 ? `${empty} vakter er ledige` : 'Alle vakter har en vakt-ansvarlig'}
          icon={<CalendarCheck aria-hidden="true" className="h-5 w-5" />}
          progress={stats.total > 0 ? stats.filled / stats.total : 0}
        />
        <StatTile
          label="Utkast"
          value={stats.drafts}
          hint="Vises bare for Admin og Vaktsjef."
          tone="warning"
        />
        <StatTile
          label="Publisert"
          value={stats.published}
          hint="Synlig for alle beboere."
          tone="success"
        />
      </div>

      <Card
        title="Vaktplan"
        description="Fordel automatisk, juster enkeltvakter i Vaktplan-fanen, og publiser når du er fornøyd."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setConfirming('clear')}
              disabled={busy || stats.drafts === 0}
            >
              Nullstill utkast
            </Button>
            <Button
              variant="secondary"
              icon={<Wand2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => void admin.autoAssign()}
              loading={busy}
              disabled={stats.drafts === 0}
            >
              Fordel automatisk
            </Button>
            <Button
              icon={<Send aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setConfirming('publish')}
              disabled={busy || stats.drafts === 0}
            >
              Publiser
            </Button>
          </>
        }
      >
        {lastRun && (
          <StatusMessage tone={lastRun.unfilled.length > 0 ? 'warning' : 'success'}>
            Fordelte {lastRun.assignments.length} vakter.
            {lastRun.unfilled.length > 0 &&
              ` ${lastRun.unfilled.length} vakter ble stående ledige fordi alle var utilgjengelige, hvilte eller hadde nådd kravet.`}
            {Object.keys(lastRun.shortfalls).length > 0 &&
              ` ${Object.keys(lastRun.shortfalls).length} beboere mangler fortsatt vakter.`}
          </StatusMessage>
        )}
        {!lastRun && missing.length > 0 && stats.total > 0 && (
          <p className="text-sm text-muted">
            {missing.length} beboere har færre vakter enn kravet. Utilgjengelige dager som er
            registrert: {unavailability.length}.
          </p>
        )}
      </Card>

      <Card title="Beboere" description="Vakter hver beboer har, mot kravet i semesteret.">
        <DataTable<ResidentRow>
          rows={rows}
          getRowKey={(row) => row.id}
          emptyMessage="Ingen beboere har vaktkrav."
          columns={[
            { key: 'name', header: 'Navn', render: (row) => row.name },
            { key: 'role', header: 'Rolle', render: (row) => row.role ?? '–' },
            {
              key: 'shifts',
              header: 'Vakter',
              render: (row) => (
                <span className="tabular-nums">
                  {row.assignedShifts} / {row.targetShifts}
                  <span className="text-subtle">
                    {' '}
                    ({formatHours(row.assignedShifts * SHIFT_HOURS)})
                  </span>
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: getStatus },
          ]}
          renderCard={(row) => (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-sm text-muted tabular-nums">
                  {row.assignedShifts} / {row.targetShifts} vakter
                </p>
              </div>
              {getStatus(row)}
            </div>
          )}
          bareCards
        />
      </Card>

      <ConfirmDialog
        open={confirming === 'clear'}
        title="Nullstille utkastet?"
        confirmLabel="Nullstill"
        tone="danger"
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(null)}
      >
        Alle som er satt opp på utkast-vakter fjernes. Publiserte vakter beholdes.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'publish'}
        title="Publisere vaktplanen?"
        confirmLabel="Publiser"
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(null)}
      >
        Alle beboere kan se vaktplanen. {empty > 0 && `${empty} vakter er fortsatt ledige. `}
        Du kan fortsatt endre enkeltvakter etterpå.
      </ConfirmDialog>
    </div>
  );
};

export default AdminTab;
