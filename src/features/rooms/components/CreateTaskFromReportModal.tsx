import { useEffect, useId, useState } from 'react';
import { getCategories } from '../../../server/dao/categoriesDAO';
import type { Category } from '../../../shared/types/regi/tasks';
import type { TaskCreationData } from '../../../shared/types/regi/tasks';
import { taskDraftFromReport } from '../reports';
import type { RoomReport } from '../types';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  StatusMessage,
  Textarea,
} from '../../../shared/components';

type CreateTaskFromReportModalProps = {
  report: RoomReport;
  busy: boolean;
  error?: string | null;
  onCreate: (reportId: string, task: TaskCreationData) => Promise<boolean>;
  onClose: () => void;
};

// A regi task filled in from a room report. Rendered only while open.
const CreateTaskFromReportModal = ({
  report,
  busy,
  error,
  onCreate,
  onClose,
}: CreateTaskFromReportModalProps) => {
  const formId = useId();
  const draft = taskDraftFromReport(report);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [category, setCategory] = useState('');
  const [hours, setHours] = useState('2');
  const [maxParticipants, setMaxParticipants] = useState('1');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((loaded) => {
        if (cancelled) return;
        setCategories(loaded);
        // Maintenance is the natural home for a room problem; otherwise the first one.
        setCategory(
          (current) =>
            current ||
            loaded.find((candidate) => candidate.name.toLowerCase() === 'vedlikehold')?.name ||
            loaded[0]?.name ||
            ''
        );
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const estimate = Number(hours);
  const participants = Number(maxParticipants);
  const invalid =
    title.trim() === '' ||
    category === '' ||
    !Number.isFinite(estimate) ||
    estimate <= 0 ||
    !Number.isInteger(participants) ||
    participants < 1;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const created = await onCreate(report.id, {
      title: title.trim(),
      category,
      description: description.trim() || undefined,
      deadline: deadline ? new Date(`${deadline}T12:00:00`) : undefined,
      hourEstimate: estimate,
      maxParticipants: participants,
      roomId: report.roomId,
    });
    if (created) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Lag oppgave"
      description={`Fra meldingen «${report.title}» på rom ${report.roomNumber}.`}
      size="md"
      fullScreenOnMobile
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={busy} disabled={invalid}>
            Opprett oppgave
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        {loadError && <StatusMessage tone="error">Kunne ikke laste kategoriene.</StatusMessage>}
        <Field label="Tittel" required>
          {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Beskrivelse">
          {(field) => (
            <Textarea
              {...field}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kategori" required>
            {(field) => (
              <Select {...field} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((candidate) => (
                  <option key={candidate.id} value={candidate.name}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Frist (valgfritt)">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            )}
          </Field>
          <Field label="Timer">
            {(field) => (
              <Input
                {...field}
                type="number"
                min="0.5"
                step="0.5"
                inputMode="decimal"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            )}
          </Field>
          <Field label="Antall deltakere">
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                inputMode="numeric"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTaskFromReportModal;
