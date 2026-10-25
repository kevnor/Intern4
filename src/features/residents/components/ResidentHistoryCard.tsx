import React from 'react';
import { Card, Skeleton } from '../../../shared/components';
import { formatDateTime } from '../../../shared/utils/date';
import { useResidentEvents } from '../hooks/useResidentEvents';
import { describeEvent } from '../offboarding';

// Who added, moved out and reactivated this resident, and when. For the people who manage residents.
const ResidentHistoryCard: React.FC<{ userId: string; version?: number }> = ({
  userId,
  version,
}) => {
  const { events, loading, error } = useResidentEvents(userId, version);

  return (
    <Card title="Historikk" description="Vises bare for dem som administrerer beboere.">
      {loading ? (
        <Skeleton className="h-16" />
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted">Ingen hendelser er registrert.</p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((event) => {
            const { title, detail } = describeEvent(event);
            return (
              <li key={event.id} className="space-y-0.5 py-2 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{title}</p>
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
      )}
    </Card>
  );
};

export default ResidentHistoryCard;
