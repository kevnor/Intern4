import type { Room } from '../rooms/types';
import type { RoomReport } from '../rooms/types';
import type { ResidentDirectoryUser } from '../../shared/types/user';
import { isActiveReport } from '../rooms/reports';

// What each source returned. A source is undefined when it could not be read (a role without
// access, or a failed request), and its numbers are then null: "unknown", not zero.
export type OverviewSources = {
  residents?: ResidentDirectoryUser[];
  rooms?: Room[];
  reports?: RoomReport[];
  pendingApprovals?: number;
};

export type AdminOverview = {
  activeResidents: number | null;
  onLeave: number | null;
  withoutRoom: number | null;
  plannedMoveOuts: number | null;
  freePlaces: number | null;
  openReports: number | null;
  pendingApprovals: number | null;
};

export const summarizeAdmin = ({
  residents,
  rooms,
  reports,
  pendingApprovals,
}: OverviewSources): AdminOverview => {
  const active = residents?.filter((resident) => resident.isActive);

  return {
    activeResidents: active ? active.length : null,
    onLeave: active ? active.filter((resident) => resident.onLeave).length : null,
    // roomNumber is 0 or missing for someone without a room.
    withoutRoom: active ? active.filter((resident) => !resident.roomNumber).length : null,
    plannedMoveOuts: active ? active.filter((resident) => resident.moveOutDate).length : null,
    freePlaces: rooms
      ? rooms.reduce((sum, room) => sum + Math.max(0, room.capacity - room.occupants.length), 0)
      : null,
    openReports: reports ? reports.filter(isActiveReport).length : null,
    pendingApprovals: pendingApprovals ?? null,
  };
};

// Residents with a planned move-out, soonest first.
export const plannedMoveOuts = (residents: ResidentDirectoryUser[]): ResidentDirectoryUser[] =>
  residents
    .filter((resident) => resident.isActive && resident.moveOutDate)
    .sort((a, b) => (a.moveOutDate as string).localeCompare(b.moveOutDate as string));
