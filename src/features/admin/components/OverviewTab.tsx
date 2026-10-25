import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  BedDouble,
  ClipboardCheck,
  DoorOpen,
  LogOut,
  Users,
} from 'lucide-react';
import { Skeleton, StatTile } from '../../../shared/components';
import { RESIDENT_PATHS } from '../../residents/paths';
import { ROOM_PATHS } from '../../rooms/paths';
import { REGI_PATHS } from '../../regi/paths';
import { ADMIN_PATHS } from '../paths';
import { useAdminOverview } from '../hooks';
import type { AdminOverview } from '../overview';

type Tile = {
  key: keyof AdminOverview;
  label: string;
  to: string;
  icon: React.ReactNode;
  // Warning when the number is above zero and someone should act on it.
  needsAction?: boolean;
};

const icon = (Icon: typeof Users) => <Icon aria-hidden="true" className="h-5 w-5" />;

const TILES: Tile[] = [
  {
    key: 'activeResidents',
    label: 'Aktive beboere',
    to: RESIDENT_PATHS.BEBOERE,
    icon: icon(Users),
  },
  { key: 'onLeave', label: 'På permisjon', to: RESIDENT_PATHS.BEBOERE, icon: icon(BedDouble) },
  {
    key: 'withoutRoom',
    label: 'Uten rom',
    to: RESIDENT_PATHS.BEBOERE,
    icon: icon(AlertTriangle),
    needsAction: true,
  },
  {
    key: 'plannedMoveOuts',
    label: 'Planlagte utflyttinger',
    to: ADMIN_PATHS.MOVE_OUTS,
    icon: icon(LogOut),
  },
  { key: 'freePlaces', label: 'Ledige plasser', to: ROOM_PATHS.ALL, icon: icon(DoorOpen) },
  {
    key: 'openReports',
    label: 'Åpne romrapporter',
    to: ROOM_PATHS.REPORTS,
    icon: icon(Bell),
    needsAction: true,
  },
  {
    key: 'pendingApprovals',
    label: 'Regi til godkjenning',
    to: REGI_PATHS.GODKJENNING,
    icon: icon(ClipboardCheck),
    needsAction: true,
  },
];

// What needs a look, each number linking to where it is dealt with. A number that cannot be read
// shows a dash.
const OverviewTab: React.FC = () => {
  const overview = useAdminOverview();

  if (!overview) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => (
          <Skeleton key={tile.key} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => {
        const value = overview[tile.key];
        return (
          <Link
            key={tile.key}
            to={tile.to}
            className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <StatTile
              label={tile.label}
              value={value ?? '–'}
              icon={tile.icon}
              tone={tile.needsAction && value ? 'warning' : 'primary'}
              hint={value === null ? 'Kunne ikke leses' : undefined}
              className="h-full transition-colors hover:bg-surface-muted"
            />
          </Link>
        );
      })}
    </div>
  );
};

export default OverviewTab;
