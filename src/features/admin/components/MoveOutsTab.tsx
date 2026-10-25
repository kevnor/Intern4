import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Skeleton,
  StatusMessage,
} from '../../../shared/components';
import { getResidentDirectoryUsers } from '../../../server/dao/userDAO';
import { cancelMoveOut } from '../../../server/dao/offboardingDAO';
import { formatDateTime, formatDeadline } from '../../../shared/utils/date';
import { getErrorMessage } from '../../../shared/utils/errors';
import type { ResidentDirectoryUser } from '../../../shared/types/user';
import { residentProfilePath } from '../../residents/paths';
import { describeEvent } from '../../residents/offboarding';
import { useResidentFeed } from '../hooks';
import { plannedMoveOuts } from '../overview';

// Planned move-outs in one list, and what has happened to residents lately.
const MoveOutsTab: React.FC = () => {
  const feed = useResidentFeed();
  const [planned, setPlanned] = useState<ResidentDirectoryUser[] | null>(null);
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<ResidentDirectoryUser | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const loadPlanned = useCallback(async () => {
    try {
      setPlanned(plannedMoveOuts(await getResidentDirectoryUsers(true)));
      setPlannedError(null);
    } catch (loadError) {
      console.error(loadError);
      setPlannedError(getErrorMessage(loadError, 'Kunne ikke laste utflyttingene.'));
    }
  }, []);

  useEffect(() => {
    void loadPlanned();
  }, [loadPlanned]);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setWorking(true);
    try {
      await cancelMoveOut(cancelling.id);
      setMessage({
        tone: 'success',
        text: `Utflyttingen til ${cancelling.name} er avbrutt.`,
      });
      await Promise.all([loadPlanned(), feed.refresh()]);
    } catch (actionError) {
      setMessage({ tone: 'error', text: getErrorMessage(actionError, 'Noe gikk galt.') });
    } finally {
      setWorking(false);
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <StatusMessage tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </StatusMessage>
      )}

      <Card
        title="Planlagte utflyttinger"
        description="Rom, vakter og innlogging ryddes natten til datoen."
      >
        {plannedError ? (
          <StatusMessage tone="error">{plannedError}</StatusMessage>
        ) : !planned ? (
          <Skeleton className="h-16" />
        ) : planned.length === 0 ? (
          <p className="text-sm text-muted">Ingen utflyttinger er planlagt.</p>
        ) : (
          <ul className="divide-y divide-border">
            {planned.map((resident) => (
              <li
                key={resident.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={residentProfilePath(resident.id)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {resident.name}
                  </Link>
                  <Badge tone="warning">{formatDeadline(resident.moveOutDate)}</Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setCancelling(resident)}>
                  Avbryt utflytting
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Siste hendelser"
        description="Hvem som er lagt til, flyttet ut eller reaktivert."
      >
        {feed.loading ? (
          <Skeleton className="h-24" />
        ) : feed.error && feed.events.length === 0 ? (
          <StatusMessage tone="error">{feed.error}</StatusMessage>
        ) : feed.events.length === 0 ? (
          <p className="text-sm text-muted">Ingen hendelser er registrert ennå.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {feed.events.map((event) => {
                const { title, detail } = describeEvent(event);
                return (
                  <li key={event.id} className="space-y-0.5 py-2 first:pt-0 last:pb-0">
                    <p className="text-sm">
                      <Link
                        to={residentProfilePath(event.userId)}
                        className="font-medium text-primary hover:underline"
                      >
                        {event.residentName}
                      </Link>
                      <span className="text-muted"> · {title}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(event.createdAt)}
                      {event.actorName ? ` · ${event.actorName}` : ''}
                    </p>
                    {detail && <p className="text-xs text-muted">{detail}</p>}
                    {event.reason && <p className="text-xs text-muted">Årsak: {event.reason}</p>}
                  </li>
                );
              })}
            </ul>
            {feed.error && (
              <StatusMessage tone="error" className="mt-3">
                {feed.error}
              </StatusMessage>
            )}
            {feed.hasMore && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                loading={feed.loadingMore}
                onClick={() => void feed.loadMore()}
              >
                Vis flere
              </Button>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!cancelling}
        title="Avbryte utflyttingen?"
        confirmLabel="Avbryt utflytting"
        loading={working}
        onCancel={() => setCancelling(null)}
        onConfirm={() => void confirmCancel()}
      >
        {cancelling &&
          `${cancelling.name} blir boende, og utflyttingen ${formatDeadline(cancelling.moveOutDate)} fjernes.`}
      </ConfirmDialog>
    </div>
  );
};

export default MoveOutsTab;
