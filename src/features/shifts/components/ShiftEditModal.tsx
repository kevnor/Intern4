import { useState } from 'react';
import { Button, Field, Modal, Select, StatusMessage } from '../../../shared/components';
import { formatDayMonth, formatWeekday } from '../calendar';
import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import type { Shift } from '../types';
import type { BasicUserWithRole } from '../../../shared/types/user';

type ShiftEditModalProps = {
  shift: Shift;
  users: BasicUserWithRole[];
  busy: boolean;
  // Why the last save failed; shown here because the modal covers the page.
  error?: string | null;
  onSave: (shiftId: string, userId: string | null) => Promise<boolean>;
  onClose: () => void;
};

// Rendered only while a shift is being edited, so the form always starts from that shift.
// Lets the Vaktsjef put anyone on a shift, or free it again.
const ShiftEditModal = ({ shift, users, busy, error, onSave, onClose }: ShiftEditModalProps) => {
  const [userId, setUserId] = useState(shift.userId ?? '');

  const handleSave = async () => {
    if (await onSave(shift.id, userId || null)) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Endre vakt"
      description={`${formatWeekday(shift.startsAt, 'long')} ${formatDayMonth(shift.startsAt)} · ${SLOT_NAMES[shift.slotType]} ${SLOT_LABELS[shift.slotType]}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button onClick={() => void handleSave()} loading={busy}>
            Lagre
          </Button>
        </>
      }
    >
      {error && (
        <StatusMessage tone="error" className="mb-4">
          {error}
        </StatusMessage>
      )}
      <Field label="Hvem har vakten?">
        {(controlProps) => (
          <Select
            {...controlProps}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            <option value="">Ledig</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.role ? ` (${user.role})` : ''}
                {user.onLeave ? ' – permisjon' : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
};

export default ShiftEditModal;
