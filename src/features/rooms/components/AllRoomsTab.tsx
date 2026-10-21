import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { filterRooms, formatRoomType, getFreeSpots, type RoomFilter } from '../rooms';
import { roomPath } from '../paths';
import type { Room } from '../types';
import {
  Badge,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedControl,
  Skeleton,
} from '../../../shared/components';

type AllRoomsTabProps = {
  rooms: Room[];
  loading: boolean;
  onRefresh?: () => void;
};

const occupantNames = (room: Room) =>
  room.occupants.length > 0 ? room.occupants.map((occupant) => occupant.userName).join(', ') : '–';

const SpaceBadge = ({ room }: { room: Room }) => {
  const free = getFreeSpots(room);
  return free > 0 ? (
    <Badge tone="success">{free === 1 ? 'Ledig plass' : `${free} ledige plasser`}</Badge>
  ) : (
    <Badge>Opptatt</Badge>
  );
};

const AllRoomsTab = ({ rooms, loading, onRefresh }: AllRoomsTabProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const visible = useMemo(() => filterRooms(rooms, query, filter), [rooms, query, filter]);
  const freeCount = useMemo(() => rooms.filter((room) => getFreeSpots(room) > 0).length, [rooms]);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Søk på romnummer, type eller beboer..."
          label="Søk i rom"
          onRefresh={onRefresh}
          className="flex-1"
        />
        <SegmentedControl<RoomFilter>
          label="Filtrer rom"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Alle (${rooms.length})` },
            { value: 'free', label: `Ledige (${freeCount})` },
          ]}
        />
      </div>

      <DataTable<Room>
        rows={visible}
        getRowKey={(room) => room.id}
        getRowLabel={(room) => `Rom ${room.number}`}
        onRowClick={(room) => navigate(roomPath(room.number))}
        emptyMessage={
          <EmptyState title="Ingen rom funnet.">Prøv et annet søk eller filter.</EmptyState>
        }
        columns={[
          {
            key: 'number',
            header: 'Rom',
            className: 'font-medium tabular-nums',
            render: (room) => room.number,
          },
          { key: 'type', header: 'Type', render: (room) => formatRoomType(room.type) },
          { key: 'occupants', header: 'Beboere', render: occupantNames },
          { key: 'space', header: 'Plass', render: (room) => <SpaceBadge room={room} /> },
        ]}
        renderCard={(room) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold tabular-nums">Rom {room.number}</p>
              <p className="text-xs text-subtle">{formatRoomType(room.type)}</p>
              <p className="truncate text-sm text-muted">{occupantNames(room)}</p>
            </div>
            <SpaceBadge room={room} />
          </div>
        )}
      />
    </div>
  );
};

export default AllRoomsTab;
