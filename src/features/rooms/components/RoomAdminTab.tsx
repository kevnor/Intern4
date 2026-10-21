import { useMemo, useState } from 'react';

import type { RoomAdmin } from '../hooks/useRoomAdmin';
import {
  describeRoomOption,
  filterRooms,
  formatRoomType,
  getAssignableRooms,
  isRoomType,
  parseRoomRange,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
} from '../rooms';
import type { Room, RoomType } from '../types';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  SearchInput,
  Select,
  Skeleton,
  StatusMessage,
} from '../../../shared/components';

type RoomAdminTabProps = {
  rooms: Room[];
  admin: RoomAdmin;
};

const toType = (value: string): RoomType | null => (isRoomType(value) ? value : null);

const TypeOptions = () => (
  <>
    <option value="">Ikke satt</option>
    {ROOM_TYPES.map((type) => (
      <option key={type} value={type}>
        {ROOM_TYPE_LABELS[type]}
      </option>
    ))}
  </>
);

const HusfarCard = ({ admin }: { admin: RoomAdmin }) => {
  const [userId, setUserId] = useState('');
  const { husfar, husfarRoom, residents, busy } = admin;

  return (
    <Card
      title="Husfar"
      description="Husfar har husfarhybelen, og står utenfor romslippet."
      actions={
        husfarRoom ? <Badge tone="primary">Husfarhybelen er rom {husfarRoom.number}</Badge> : null
      }
    >
      <div className="space-y-4">
        {!husfarRoom && (
          <StatusMessage tone="warning">
            Velg først hvilket rom som er husfarhybelen i romtypene under.
          </StatusMessage>
        )}
        {husfar ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-medium">{husfar.name}</span> er Husfar
              {husfar.roomNumber > 0 && ` og bor på rom ${husfar.roomNumber}`}.
            </p>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void admin.changeHusfar(husfar.id, false)}
            >
              Fjern som Husfar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Ny Husfar" className="sm:w-72">
              {(field) => (
                <Select {...field} value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Velg beboer</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.name}
                      {resident.roomNumber > 0 ? ` (rom ${resident.roomNumber})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button
              loading={busy}
              disabled={!userId || !husfarRoom}
              onClick={() =>
                void admin.changeHusfar(userId, true).then((ok) => ok && setUserId(''))
              }
            >
              Sett som Husfar
            </Button>
          </div>
        )}
        <p className="text-sm text-muted">
          Om Husfar ikke vil ha husfarhybelen: fjern Husfar-rollen, og flytt dem til et annet rom
          fra rommets side.
        </p>
      </div>
    </Card>
  );
};

const WithoutRoomCard = ({ rooms, admin }: { rooms: Room[]; admin: RoomAdmin }) => {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const assignable = useMemo(() => getAssignableRooms(rooms), [rooms]);

  return (
    <Card title="Beboere uten rom" description="Aktive beboere som ikke har fått rom.">
      {admin.withoutRoom.length === 0 ? (
        <p className="text-sm text-subtle">Alle aktive beboere har rom.</p>
      ) : (
        <ul className="divide-y divide-border">
          {admin.withoutRoom.map((resident) => (
            <li key={resident.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1 font-medium">{resident.name}</span>
              <Select
                aria-label={`Rom til ${resident.name}`}
                className="w-56"
                value={choices[resident.id] ?? ''}
                onChange={(e) =>
                  setChoices((current) => ({ ...current, [resident.id]: e.target.value }))
                }
              >
                <option value="">Velg rom</option>
                {assignable.map((room) => (
                  <option key={room.id} value={room.id}>
                    {describeRoomOption(room)}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                loading={admin.busy}
                disabled={!choices[resident.id]}
                aria-label={`Tildel rom til ${resident.name}`}
                onClick={() => void admin.assign(resident.id, choices[resident.id])}
              >
                Tildel
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const RoomTypesCard = ({ rooms, admin }: { rooms: Room[]; admin: RoomAdmin }) => {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [rangeType, setRangeType] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const visible = useMemo(() => filterRooms(rooms, query), [rooms, query]);
  const untyped = useMemo(() => rooms.filter((room) => room.type === null).length, [rooms]);

  const applyRange = async () => {
    const parsed = parseRoomRange(range);
    if (typeof parsed === 'string') {
      setRangeError(parsed);
      return;
    }
    setRangeError(null);
    if (await admin.changeRangeType(parsed.from, parsed.to, toType(rangeType))) {
      setRange({ from: '', to: '' });
    }
  };

  return (
    <Card
      title="Romtyper"
      description={
        untyped > 0
          ? `${untyped} av ${rooms.length} rom mangler type. Typen bestemmer hvor mange som kan bo der.`
          : 'Typen bestemmer hvor mange som kan bo på rommet.'
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Fra rom" error={rangeError ?? undefined}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                value={range.from}
                invalid={!!rangeError}
                onChange={(e) => setRange((current) => ({ ...current, from: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Til rom">
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                value={range.to}
                onChange={(e) => setRange((current) => ({ ...current, to: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Type">
            {(field) => (
              <Select {...field} value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
                <TypeOptions />
              </Select>
            )}
          </Field>
          <Button variant="secondary" loading={admin.busy} onClick={() => void applyRange()}>
            Sett type på området
          </Button>
        </div>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Søk på romnummer, type eller beboer..."
          label="Søk i romtyper"
        />

        <DataTable<Room>
          rows={visible}
          getRowKey={(room) => room.id}
          columns={[
            {
              key: 'number',
              header: 'Rom',
              className: 'font-medium tabular-nums',
              render: (room) => room.number,
            },
            {
              key: 'type',
              header: 'Type',
              render: (room) => (
                <Select
                  aria-label={`Type for rom ${room.number}`}
                  className="w-48"
                  value={room.type ?? ''}
                  disabled={admin.busy}
                  onChange={(e) => void admin.changeType(room.id, toType(e.target.value))}
                >
                  <TypeOptions />
                </Select>
              ),
            },
            {
              key: 'occupants',
              header: 'Beboere',
              render: (room) =>
                room.occupants.length > 0
                  ? room.occupants.map((occupant) => occupant.userName).join(', ')
                  : '–',
            },
            { key: 'capacity', header: 'Plass', render: (room) => room.capacity },
          ]}
          renderCard={(room) => (
            <div className="space-y-2">
              <p className="font-semibold tabular-nums">Rom {room.number}</p>
              <Select
                aria-label={`Type for rom ${room.number}`}
                value={room.type ?? ''}
                disabled={admin.busy}
                onChange={(e) => void admin.changeType(room.id, toType(e.target.value))}
              >
                <TypeOptions />
              </Select>
              <p className="text-xs text-subtle">
                {formatRoomType(room.type)} · plass til {room.capacity}
              </p>
            </div>
          )}
          bareCards
        />
      </div>
    </Card>
  );
};

const RoomAdminTab = ({ rooms, admin }: RoomAdminTabProps) => {
  if (admin.loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {admin.error && (
        <StatusMessage tone="error" onDismiss={admin.clearMessages}>
          {admin.error}
        </StatusMessage>
      )}
      {admin.notice && (
        <StatusMessage tone="success" onDismiss={admin.clearMessages}>
          {admin.notice}
        </StatusMessage>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HusfarCard admin={admin} />
        <WithoutRoomCard rooms={rooms} admin={admin} />
      </div>
      <RoomTypesCard rooms={rooms} admin={admin} />
    </div>
  );
};

export default RoomAdminTab;
