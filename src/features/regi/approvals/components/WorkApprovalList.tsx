import React from 'react';
import { Ban, Calendar, Check, Clock, ImageIcon, PartyPopper } from 'lucide-react';
import { PendingRegiApproval } from '../../../../shared/types/regi';
import WorkApprovalModal from './WorkApprovalModal';
import type { WorkApprovalsState } from '../hooks/useWorkApprovals';
import {
  Badge,
  Button,
  CategoryBadge,
  DataTable,
  EmptyState,
  SearchInput,
  Skeleton,
  StatusMessage,
} from '../../../../shared/components';
import { formatDate, formatHours } from '../../../../shared/utils/date';

type WorkApprovalListProps = Pick<
  WorkApprovalsState,
  | 'approvals'
  | 'filtered'
  | 'selected'
  | 'setSelected'
  | 'loading'
  | 'busyIds'
  | 'error'
  | 'notice'
  | 'clearNotice'
  | 'query'
  | 'setQuery'
  | 'load'
  | 'approve'
  | 'reject'
> & { categoryColors?: Record<string, string> };

const SourceBadge = ({ approval }: { approval: PendingRegiApproval }) =>
  approval.sourceType === 'task' ? <Badge tone="info">Oppgave</Badge> : <Badge>Manuell</Badge>;

const WorkApprovalList: React.FC<WorkApprovalListProps> = ({
  approvals,
  filtered,
  selected,
  setSelected,
  loading,
  busyIds,
  error,
  notice,
  clearNotice,
  query,
  setQuery,
  load,
  approve,
  reject,
  categoryColors = {},
}) => {
  const actionButtons = (approval: PendingRegiApproval, fullWidth = false) => {
    const busy = busyIds.has(approval.id);

    return (
      <div className="relative z-10 flex gap-2">
        <Button
          variant="success"
          size="sm"
          fullWidth={fullWidth}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void approve(approval.id);
          }}
          aria-label={`Godkjenn ${approval.title}`}
          icon={<Check aria-hidden="true" className="h-4 w-4" />}
        >
          Godkjenn
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth={fullWidth}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void reject(approval.id);
          }}
          aria-label={`Avslå ${approval.title}`}
          icon={<Ban aria-hidden="true" className="h-4 w-4" />}
          className="text-danger"
        >
          Avslå
        </Button>
      </div>
    );
  };

  const imageCount = (approval: PendingRegiApproval) => approval.imagePaths?.length ?? 0;

  return (
    <div className="space-y-4">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Søk på navn, tittel, beskrivelse eller kategori..."
        label="Søk i godkjenninger"
        onRefresh={() => void load()}
        refreshing={loading}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {notice && (
        <StatusMessage tone={notice.tone} onDismiss={clearNotice}>
          {notice.text}
        </StatusMessage>
      )}

      {!loading && approvals.length > 0 && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-fg">{approvals.length}</span> venter på godkjenning
          {filtered.length !== approvals.length && ` · ${filtered.length} vises`}
        </p>
      )}

      {loading ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Laster...</span>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-32 rounded-2xl md:h-16" />
          ))}
        </div>
      ) : (
        <DataTable
          rows={filtered}
          getRowKey={(approval) => approval.id}
          onRowClick={setSelected}
          getRowLabel={(approval) => `Åpne ${approval.title}`}
          bareCards
          emptyMessage={
            approvals.length === 0 ? (
              <EmptyState
                title="Ingen ventende registreringer."
                icon={<PartyPopper className="h-6 w-6" />}
              >
                Alt er behandlet. Godt jobba!
              </EmptyState>
            ) : (
              <EmptyState title="Ingen treff">Ingen registreringer matcher søket.</EmptyState>
            )
          }
          renderCard={(approval) => (
            <article
              data-testid="approval-card"
              className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{approval.userName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
                    <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                    {formatDate(approval.date)}
                  </p>
                </div>
                <p className="flex items-center gap-1 whitespace-nowrap text-lg font-semibold tabular-nums">
                  <Clock aria-hidden="true" className="h-4 w-4 text-subtle" />
                  {formatHours(approval.hours)}
                </p>
              </div>

              <h3 className="mt-3 font-medium">
                <button
                  type="button"
                  onClick={() => setSelected(approval)}
                  className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {approval.title}
                </button>
              </h3>
              {approval.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{approval.description}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CategoryBadge name={approval.category} color={categoryColors[approval.category]} />
                <SourceBadge approval={approval} />
                {imageCount(approval) > 0 && (
                  <Badge>
                    <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {imageCount(approval)}
                  </Badge>
                )}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                {actionButtons(approval, true)}
              </div>
            </article>
          )}
          columns={[
            {
              key: 'user',
              header: 'Navn',
              render: (approval) => (
                <>
                  <div className="font-medium">{approval.userName}</div>
                  {approval.userEmail && (
                    <div className="truncate text-xs text-subtle">{approval.userEmail}</div>
                  )}
                </>
              ),
            },
            {
              key: 'title',
              header: 'Tittel',
              render: (approval) => (
                <div className="max-w-sm">
                  <div className="truncate font-medium" title={approval.title}>
                    {approval.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <CategoryBadge
                      name={approval.category}
                      color={categoryColors[approval.category]}
                    />
                    <SourceBadge approval={approval} />
                    {imageCount(approval) > 0 && (
                      <Badge>
                        <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        {imageCount(approval)}
                      </Badge>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'date',
              header: 'Utført',
              className: 'whitespace-nowrap',
              render: (approval) => formatDate(approval.date),
            },
            {
              key: 'hours',
              header: 'Timer',
              className: 'whitespace-nowrap font-medium tabular-nums',
              render: (approval) => formatHours(approval.hours),
            },
            {
              key: 'actions',
              header: <span className="sr-only">Handlinger</span>,
              render: (approval) => actionButtons(approval),
            },
          ]}
        />
      )}

      {selected && (
        <WorkApprovalModal
          key={selected.id}
          approval={selected}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={reject}
          isProcessing={busyIds.has(selected.id)}
          categoryColor={categoryColors[selected.category]}
        />
      )}
    </div>
  );
};

export default WorkApprovalList;
