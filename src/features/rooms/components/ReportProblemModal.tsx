import { useId, useState } from 'react';
import { Button, Field, Input, Modal, StatusMessage, Textarea } from '../../../shared/components';

type ReportProblemModalProps = {
  roomNumber: number;
  busy: boolean;
  error?: string | null;
  onSubmit: (title: string, description: string) => Promise<boolean>;
  onClose: () => void;
};

// Rendered only while open, so the form always starts empty.
const ReportProblemModal = ({
  roomNumber,
  busy,
  error,
  onSubmit,
  onClose,
}: ReportProblemModalProps) => {
  const formId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const invalid = title.trim() === '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    if (await onSubmit(title, description)) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Meld problem"
      description={`Rom ${roomNumber}. Regisjef ser meldingen og kan lage en oppgave av den.`}
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={busy} disabled={invalid}>
            Send melding
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        <Field label="Hva er problemet?" required>
          {(field) => (
            <Input
              {...field}
              value={title}
              maxLength={120}
              placeholder="F.eks. ødelagt lås, mugg på veggen"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="Utfyllende beskrivelse (valgfritt)">
          {(field) => (
            <Textarea
              {...field}
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};

export default ReportProblemModal;
