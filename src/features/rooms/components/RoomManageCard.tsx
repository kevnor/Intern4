import { useState } from 'react';
import type { RoomAdmin } from '../hooks/useRoomAdmin';
import { getFreeSpots } from '../rooms';
import type { Room } from '../types';
import { Button, Card, Field, Select, StatusMessage } from '../../../shared/components';

type RoomManageCardProps = {
  room: Room;
  admin: RoomAdmin;
};

// Room managers move residents in and out from the room's own page.
const RoomManageCard = ({ room, admin }: RoomManageCardProps) => {
  const [userId, setUserId] = useState('');
  const candidates = admin.residents.filter(
    (resident) => !room.occupants.some((occupant) => occupant.userId === resident.id)
  );
  const full = getFreeSpots(room) === 0;

  return (
    <Card title="Administrer" description="Bare for romsjef, Data og Admin.">
      <div className="space-y-4">
        {admin.error && (
          <StatusMessage tone="error" onDismiss={admin.clearMessages}>
            {admin.error}
          </StatusMessage>
        )}

        {room.occupants.length > 0 && (
          <ul className="divide-y divide-border">
            {room.occupants.map((occupant) => (
              <li key={occupant.userId} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 font-medium">{occupant.userName}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={admin.busy}
                  aria-label={`Flytt ut ${occupant.userName}`}
                  onClick={() => void admin.assign(occupant.userId, null)}
                >
                  Flytt ut
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Flytt inn beboer"
            hint={
              full
                ? 'Rommet er fullt. Flytt noen ut først.'
                : 'Beboerens forrige rom avsluttes i dag.'
            }
            className="sm:w-80"
          >
            {(field) => (
              <Select
                {...field}
                value={userId}
                disabled={full}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">Velg beboer</option>
                {candidates.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.name}
                    {resident.roomNumber > 0 ? ` (rom ${resident.roomNumber})` : ' (uten rom)'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            loading={admin.busy}
            disabled={!userId || full}
            onClick={() => void admin.assign(userId, room.id).then((ok) => ok && setUserId(''))}
          >
            Flytt hit
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default RoomManageCard;
