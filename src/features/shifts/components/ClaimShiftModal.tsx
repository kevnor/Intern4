import { Button, Modal, StatusMessage } from '../../../shared/components';
import { formatDayMonth, formatWeekday } from '../calendar';
import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import { formatKroner } from '../swaps';
import type { Shift } from '../types';

type ClaimShiftModalProps = {
  shift: Shift;
  busy: boolean;
  restConflict: boolean;
  onClaim: (shiftId: string) => Promise<boolean>;
  onClose: () => void;
};

const ClaimShiftModal = ({ shift, busy, restConflict, onClaim, onClose }: ClaimShiftModalProps) => {
  const handleClaim = async () => {
    if (await onClaim(shift.id)) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Ta vakten?"
      description={`${formatWeekday(shift.startsAt, 'long')} ${formatDayMonth(shift.startsAt)} · ${SLOT_NAMES[shift.slotType]} ${SLOT_LABELS[shift.slotType]}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button onClick={() => void handleClaim()} loading={busy}>
            Ta vakten
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Nåværende vakt</dt>
            <dd className="font-medium">{shift.userName ?? 'Ukjent'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{shift.swapOfferAmount ? 'Du får' : 'Betaling'}</dt>
            <dd className="font-medium">
              {shift.swapOfferAmount
                ? `${formatKroner(shift.swapOfferAmount)} fra ${shift.userName ?? 'ukjent'}`
                : 'Ingen betaling'}
            </dd>
          </div>
          {shift.swapNote && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Merknad</dt>
              <dd className="text-right">{shift.swapNote}</dd>
            </div>
          )}
        </dl>
        {shift.swapOfferAmount ? (
          <p className="text-sm text-muted">
            Den som gir bort vakten betaler deg. Pengene gjør dere opp utenfor appen, og dere kan
            begge krysse av når de er betalt.
          </p>
        ) : null}
        {restConflict && (
          <StatusMessage tone="warning">
            Du har en annen vakt rett før eller etter denne, så du får mindre enn 12 timer hvile.
          </StatusMessage>
        )}
      </div>
    </Modal>
  );
};

export default ClaimShiftModal;
