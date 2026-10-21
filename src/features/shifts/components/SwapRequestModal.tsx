import { useState } from 'react';
import { Button, Field, Input, Modal, StatusMessage } from '../../../shared/components';
import { formatDayMonth, formatWeekday } from '../calendar';
import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import type { Shift } from '../types';

type SwapRequestModalProps = {
  shift: Shift;
  busy: boolean;
  error?: string | null;
  onRequest: (shiftId: string, amount: number | null, note: string) => Promise<boolean>;
  onCancelSwap: (shiftId: string) => Promise<boolean>;
  onClose: () => void;
};

// Rendered only while a shift is open, so the form always starts from that shift.
const SwapRequestModal = ({
  shift,
  busy,
  error,
  onRequest,
  onCancelSwap,
  onClose,
}: SwapRequestModalProps) => {
  const [amount, setAmount] = useState(shift.swapOfferAmount?.toString() ?? '');
  const [note, setNote] = useState(shift.swapNote ?? '');

  const parsed = amount.trim() === '' ? null : Number(amount);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0);

  const handleRequest = async () => {
    if (invalid) return;
    if (await onRequest(shift.id, parsed, note)) onClose();
  };

  const handleCancel = async () => {
    if (await onCancelSwap(shift.id)) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={shift.swapRequested ? 'Bytte søkes' : 'Trenger bytte'}
      description={`${formatWeekday(shift.startsAt, 'long')} ${formatDayMonth(shift.startsAt)} · ${SLOT_NAMES[shift.slotType]} ${SLOT_LABELS[shift.slotType]}`}
      size="sm"
      footer={
        <>
          {shift.swapRequested && (
            <Button variant="danger" onClick={() => void handleCancel()} disabled={busy}>
              Avbryt bytte
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Lukk
          </Button>
          <Button onClick={() => void handleRequest()} loading={busy} disabled={invalid}>
            {shift.swapRequested ? 'Oppdater' : 'Be om bytte'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        <p className="text-sm text-muted">
          Vakten vises for alle beboere som ledig for bytte. Du har den til noen har tatt den.
        </p>
        <Field
          label="Tilbud (kr, valgfritt)"
          hint="Betal en annen beboer for å ta vakten. Pengene gjør dere opp utenfor appen."
          error={invalid ? 'Skriv inn et beløp på 0 kr eller mer.' : undefined}
        >
          {(controlProps) => (
            <Input
              {...controlProps}
              type="number"
              min={0}
              step="10"
              inputMode="decimal"
              value={amount}
              invalid={invalid}
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
        </Field>
        <Field label="Merknad (valgfritt)">
          {(controlProps) => (
            <Input
              {...controlProps}
              value={note}
              maxLength={120}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
};

export default SwapRequestModal;
