import React, { useEffect, useState } from 'react';
import {
  Button,
  Field,
  Input,
  Modal,
  SegmentedControl,
  StatusMessage,
} from '../../../shared/components';
import { Skeleton } from '../../../shared/components';
import { deleteUser } from '../../../server/dao/userDAO';
import { getOffboardingPreview, planMoveOut } from '../../../server/dao/offboardingDAO';
import { formatDeadline } from '../../../shared/utils/date';
import { getErrorMessage } from '../../../shared/utils/errors';
import { describeOffboarding, earliestMoveOutDate, type OffboardingPreview } from '../offboarding';

type When = 'now' | 'date';

// Moving someone out, now or on a date: shows what will happen before it does.
const OffboardDialog: React.FC<{
  resident: { id: string; name: string };
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ resident, onClose, onDone }) => {
  const [preview, setPreview] = useState<OffboardingPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [when, setWhen] = useState<When>('now');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const earliest = earliestMoveOutDate();

  useEffect(() => {
    let current = true;
    getOffboardingPreview(resident.id)
      .then((result) => current && setPreview(result))
      .catch((loadError) => {
        console.error(loadError);
        if (current)
          setPreviewError(getErrorMessage(loadError, 'Kunne ikke hente oppsummeringen.'));
      });
    return () => {
      current = false;
    };
  }, [resident.id]);

  const dateValid = when === 'now' || (date !== '' && date >= earliest);

  const confirm = async () => {
    setWorking(true);
    setError(null);
    try {
      if (when === 'now') {
        await deleteUser(resident.id, reason);
        onDone(`${resident.name} er flyttet ut.`);
      } else {
        await planMoveOut(resident.id, date, reason);
        onDone(`Utflyttingen til ${resident.name} er planlagt til ${formatDeadline(date)}.`);
      }
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'Noe gikk galt.'));
      setWorking(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Flytt ut ${resident.name}?`}
      size="sm"
      closeOnBackdrop={!working}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={working}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirm()}
            loading={working}
            disabled={!preview || !dateValid}
          >
            {when === 'now' ? 'Flytt ut nå' : 'Planlegg utflytting'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <SegmentedControl
          label="Når"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'now', label: 'Nå' },
            { value: 'date', label: 'På en dato' },
          ]}
        />

        {when === 'date' && (
          <Field
            label="Utflyttingsdato"
            hint="Beboeren flyttes ut natten til denne datoen."
            error={date !== '' && date < earliest ? 'Datoen må være frem i tid.' : undefined}
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                min={earliest}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            )}
          </Field>
        )}

        <div className="space-y-2">
          <p className="font-medium">
            {when === 'now' ? 'Dette skjer nå:' : 'Dette skjer på datoen:'}
          </p>
          {previewError ? (
            <StatusMessage tone="error">{previewError}</StatusMessage>
          ) : preview ? (
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {describeOffboarding(preview).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <Skeleton className="h-20" />
          )}
        </div>

        <Field label="Årsak (valgfritt)" hint="Vises i historikken til beboeren.">
          {(field) => (
            <Input
              {...field}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>

        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </div>
    </Modal>
  );
};

export default OffboardDialog;
