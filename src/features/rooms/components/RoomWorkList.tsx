import type { RoomWork } from '../types';
import { Badge } from '../../../shared/components';
import { formatDate, formatHours } from '../../../shared/utils/date';

type RoomWorkListProps = {
  work: RoomWork[];
};

export const totalApprovedHours = (work: RoomWork[]): number =>
  work.filter((entry) => entry.approved).reduce((total, entry) => total + entry.hours, 0);

// Work done on a room, newest first. Work Regisjef hasn't confirmed yet is marked as waiting.
const RoomWorkList = ({ work }: RoomWorkListProps) => {
  if (work.length === 0) {
    return <p className="text-sm text-subtle">Ingen arbeid er registrert på rommet ennå.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {work.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="font-medium">
              {entry.title}
              {entry.isTask && <span className="text-sm font-normal text-subtle"> · oppgave</span>}
            </p>
            <p className="text-sm text-muted">
              {entry.userName} · {formatDate(entry.performedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums">{formatHours(entry.hours)}</span>
            {!entry.approved && <Badge tone="warning">Venter på godkjenning</Badge>}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default RoomWorkList;
