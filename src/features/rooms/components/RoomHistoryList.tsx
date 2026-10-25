import { Link } from 'react-router-dom';
import { residentProfilePath } from '../../residents/paths';
import { roomPath } from '../paths';
import { formatStay } from '../rooms';
import type { Occupancy } from '../types';

type RoomHistoryListProps = {
  stays: Occupancy[];
  // What each row is about: the resident (a room's history) or the room (a resident's history).
  subject: 'resident' | 'room';
  emptyText?: string;
};

const RoomHistoryList = ({
  stays,
  subject,
  emptyText = 'Ingen tidligere beboere registrert.',
}: RoomHistoryListProps) => {
  if (stays.length === 0) return <p className="text-sm text-subtle">{emptyText}</p>;

  return (
    <ol className="divide-y divide-border">
      {stays.map((stay) => (
        <li key={stay.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
          {subject === 'resident' ? (
            <Link
              to={residentProfilePath(stay.userId)}
              className="font-medium text-primary hover:underline"
            >
              {stay.userName}
            </Link>
          ) : (
            <Link
              to={roomPath(stay.roomNumber)}
              className="font-medium text-primary hover:underline"
            >
              Rom {stay.roomNumber}
            </Link>
          )}
          <span className="text-sm tabular-nums text-muted">{formatStay(stay)}</span>
        </li>
      ))}
    </ol>
  );
};

export default RoomHistoryList;
