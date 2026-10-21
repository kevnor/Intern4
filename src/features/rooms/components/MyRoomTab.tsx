import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Wrench } from 'lucide-react';
import ReportList from './ReportList';
import ReportProblemModal from './ReportProblemModal';
import RoomHistoryList from './RoomHistoryList';
import { useUserRoomHistory } from '../hooks/useOccupancyHistory';
import { useRoomReports } from '../hooks/useRoomReports';
import { formatRoomType, getRoomOfUser } from '../rooms';
import { roomPath } from '../paths';
import type { Room } from '../types';
import { residentProfilePath } from '../../residents/paths';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  StatusMessage,
} from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';

type MyRoomTabProps = {
  rooms: Room[];
  loading: boolean;
  userId: string;
};

const MyRoomTab = ({ rooms, loading, userId }: MyRoomTabProps) => {
  const history = useUserRoomHistory(userId);
  const room = getRoomOfUser(rooms, userId);
  const reports = useRoomReports({ roomId: room?.id, enabled: Boolean(room) });
  const [reporting, setReporting] = useState(false);
  const roommates = room?.occupants.filter((occupant) => occupant.userId !== userId) ?? [];
  const since = room?.occupants.find((occupant) => occupant.userId === userId)?.movedIn;

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {room ? (
        <Card
          title={`Rom ${room.number}`}
          description={since ? `Du har bodd her siden ${formatDate(since)}.` : undefined}
          actions={<Badge tone="primary">{formatRoomType(room.type)}</Badge>}
        >
          <div className="space-y-3">
            {room.capacity > 1 &&
              (roommates.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Du deler rom med</p>
                  <ul className="mt-1 space-y-1">
                    {roommates.map((roommate) => (
                      <li key={roommate.userId}>
                        <Link
                          to={residentProfilePath(roommate.userId)}
                          className="text-primary hover:underline"
                        >
                          {roommate.userName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted">Du har rommet for deg selv akkurat nå.</p>
              ))}
            <Link
              to={roomPath(room.number)}
              className="inline-block text-sm text-primary hover:underline"
            >
              Se rommets historikk
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="Du har ikke tildelt rom"
          icon={<DoorOpen aria-hidden="true" className="h-6 w-6" />}
        >
          Romsjefen tildeler rom. Ta kontakt hvis du mener dette er feil.
        </EmptyState>
      )}

      {room && (
        <Card
          title="Problemer på rommet"
          description="Meld fra om noe må fikses. Regisjef kan lage en oppgave av det."
          actions={
            <Button
              size="sm"
              icon={<Wrench aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                reports.clearError();
                setReporting(true);
              }}
            >
              Meld problem
            </Button>
          }
        >
          <div className="space-y-3">
            {reports.error && !reporting && (
              <StatusMessage tone="error" onDismiss={reports.clearError}>
                {reports.error}
              </StatusMessage>
            )}
            {reports.loading ? (
              <Skeleton className="h-16" />
            ) : (
              <ReportList
                reports={reports.reports}
                emptyText="Ingen meldinger for rommet."
                renderActions={(report) =>
                  report.status === 'open' && report.reportedBy === userId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={reports.busy}
                      onClick={() => void reports.withdraw(report.id)}
                    >
                      Trekk tilbake
                    </Button>
                  ) : null
                }
              />
            )}
          </div>
        </Card>
      )}

      <Card title="Dine rom" description="Rommene du har bodd i.">
        {history.loading ? (
          <Skeleton className="h-24" />
        ) : history.error ? (
          <p className="text-sm text-danger">{history.error}</p>
        ) : (
          <RoomHistoryList stays={history.stays} subject="room" emptyText="Ingen rom registrert." />
        )}
      </Card>

      {room && reporting && (
        <ReportProblemModal
          roomNumber={room.number}
          busy={reports.busy}
          error={reports.error}
          onSubmit={(title, description) =>
            reports.report({ roomId: room.id, reportedBy: userId, title, description })
          }
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
};

export default MyRoomTab;
