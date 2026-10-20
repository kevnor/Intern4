import { Link } from 'react-router-dom';
import { DoorOpen } from 'lucide-react';
import RoomHistoryList from './RoomHistoryList';
import { useUserRoomHistory } from '../hooks/useOccupancyHistory';
import { formatRoomType, getRoomOfUser } from '../rooms';
import { roomPath } from '../paths';
import type { Room } from '../types';
import { residentProfilePath } from '../../residents/paths';
import { Badge, Card, EmptyState, Skeleton } from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';

type MyRoomTabProps = {
  rooms: Room[];
  loading: boolean;
  userId: string;
};

const MyRoomTab = ({ rooms, loading, userId }: MyRoomTabProps) => {
  const history = useUserRoomHistory(userId);
  const room = getRoomOfUser(rooms, userId);
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

      <Card title="Dine rom" description="Rommene du har bodd i.">
        {history.loading ? (
          <Skeleton className="h-24" />
        ) : history.error ? (
          <p className="text-sm text-danger">{history.error}</p>
        ) : (
          <RoomHistoryList stays={history.stays} subject="room" emptyText="Ingen rom registrert." />
        )}
      </Card>
    </div>
  );
};

export default MyRoomTab;
