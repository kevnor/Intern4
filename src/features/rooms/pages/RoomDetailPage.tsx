import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RoomHistoryList from '../components/RoomHistoryList';
import { useRoomHistory } from '../hooks/useOccupancyHistory';
import { useRooms } from '../hooks/useRooms';
import { formatRoomType, getFreeSpots } from '../rooms';
import { ROOM_PATHS } from '../paths';
import { residentProfilePath } from '../../residents/paths';
import { PageLayout } from '../../../shared/layouts';
import { Badge, Card, EmptyState, Skeleton, StatusMessage } from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';

const RoomDetailPage = () => {
  const { number } = useParams();
  const { rooms, loading, error } = useRooms();
  const room = rooms.find((candidate) => String(candidate.number) === number);
  const history = useRoomHistory(room?.id);

  const back = (
    <Link
      to={ROOM_PATHS.ALL}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Alle rom
    </Link>
  );

  if (loading) {
    return (
      <PageLayout title="Rom" headerContent={back}>
        <Skeleton className="h-64" />
      </PageLayout>
    );
  }

  if (!room) {
    return (
      <PageLayout title="Rom" headerContent={back}>
        {error ? (
          <StatusMessage tone="error">{error}</StatusMessage>
        ) : (
          <EmptyState title="Fant ikke rommet">
            Det finnes ikke noe rom med nummer {number}.
          </EmptyState>
        )}
      </PageLayout>
    );
  }

  const free = getFreeSpots(room);

  return (
    <PageLayout
      title={`Rom ${room.number}`}
      description={`${formatRoomType(room.type)} · plass til ${room.capacity}`}
      headerContent={back}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Bor her nå"
          actions={
            free > 0 ? (
              <Badge tone="success">{free === 1 ? 'Ledig plass' : `${free} ledige plasser`}</Badge>
            ) : undefined
          }
        >
          {room.occupants.length === 0 ? (
            <p className="text-sm text-subtle">Rommet er ledig.</p>
          ) : (
            <ul className="divide-y divide-border">
              {room.occupants.map((occupant) => (
                <li
                  key={occupant.userId}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                >
                  <Link
                    to={residentProfilePath(occupant.userId)}
                    className="font-medium text-primary hover:underline"
                  >
                    {occupant.userName}
                  </Link>
                  <span className="text-sm text-muted">Siden {formatDate(occupant.movedIn)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Historikk" description="Alle som har bodd her, nyeste først.">
          {history.loading ? (
            <Skeleton className="h-24" />
          ) : history.error ? (
            <p className="text-sm text-danger">{history.error}</p>
          ) : (
            <RoomHistoryList stays={history.stays} subject="resident" />
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

export default RoomDetailPage;
