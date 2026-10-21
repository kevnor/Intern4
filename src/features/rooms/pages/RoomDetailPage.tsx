import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RoomHistoryList from '../components/RoomHistoryList';
import ReportList from '../components/ReportList';
import RoomWorkList from '../components/RoomWorkList';
import RoomManageCard from '../components/RoomManageCard';
import { useAuth } from '../../../app/providers/AuthContext';
import { useRoomHistory } from '../hooks/useOccupancyHistory';
import { useRoomAdmin } from '../hooks/useRoomAdmin';
import { useRoomReports } from '../hooks/useRoomReports';
import { useRoomWork } from '../hooks/useRoomWork';
import { canHandleReports } from '../reports';
import { useRooms } from '../hooks/useRooms';
import { canManageRooms } from '../permissions';
import { formatRoomType, getFreeSpots, totalApprovedHours } from '../rooms';
import { ROOM_PATHS } from '../paths';
import { residentProfilePath } from '../../residents/paths';
import { PageLayout } from '../../../shared/layouts';
import { Badge, Card, EmptyState, Skeleton, StatusMessage } from '../../../shared/components';
import { formatDate, formatHours } from '../../../shared/utils/date';

const RoomDetailPage = () => {
  const { number } = useParams();
  const { user } = useAuth();
  const { rooms, loading, error, reload } = useRooms();
  const room = rooms.find((candidate) => String(candidate.number) === number);
  const isManager = canManageRooms(user?.role);
  const lives = Boolean(room?.occupants.some((occupant) => occupant.userId === user?.id));
  // Residents of the room and the people who handle reports see its reports.
  const reports = useRoomReports({
    roomId: room?.id,
    enabled: Boolean(room) && (lives || canHandleReports(user?.role)),
  });
  const admin = useRoomAdmin({ enabled: isManager, rooms, reloadRooms: reload });
  // Moving someone in or out changes the history, so it is reloaded along with who lives here.
  const roomWork = useRoomWork(room?.id);
  const history = useRoomHistory(
    room?.id,
    room?.occupants.map((occupant) => occupant.userId).join(',')
  );

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

      <Card
        title="Utført arbeid"
        description={
          roomWork.work.length > 0
            ? `${formatHours(totalApprovedHours(roomWork.work))} godkjent regi på rommet.`
            : 'Regi som er gjort på rommet.'
        }
      >
        {roomWork.loading ? (
          <Skeleton className="h-16" />
        ) : roomWork.error ? (
          <p className="text-sm text-danger">{roomWork.error}</p>
        ) : (
          <RoomWorkList work={roomWork.work} />
        )}
      </Card>

      {reports.reports.length > 0 && (
        <Card title="Meldinger" description="Problemer meldt for rommet.">
          <ReportList reports={reports.reports} emptyText="Ingen meldinger." />
        </Card>
      )}

      {isManager && <RoomManageCard room={room} admin={admin} />}
    </PageLayout>
  );
};

export default RoomDetailPage;
