import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../../app/providers/AuthContext';
import { WorkTypeSchema } from '../../../../shared/types/regi';
import { useGrantRegiWorkflow } from '../hooks/useGrantRegiWorkflow';
import {
  Button,
  Field,
  Input,
  Select,
  StatusMessage,
  Textarea,
} from '../../../../shared/components';
import { formatDateColumnValue } from '../../../../shared/utils/date';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const today = () => formatDateColumnValue(new Date());

const FormSchema = z.object({
  userId: z.string().uuid({ message: 'Velg en beboer' }),
  title: z.string().trim().min(1, 'Skriv en kort tittel'),
  description: z.string().trim().min(1, 'Beskriv arbeidet'),
  date: z
    .string()
    .min(1, 'Velg dato')
    .refine((value) => value <= today(), 'Datoen kan ikke være i fremtiden'),
  hours: z.coerce.number().positive('Må være mer enn 0'),
  type: WorkTypeSchema,
});

type FormState = {
  userId: string;
  title: string;
  description: string;
  date: string;
  hours: string;
  type: string;
};

const emptyForm = (type = '', userId = ''): FormState => ({
  userId,
  title: '',
  description: '',
  date: today(),
  hours: '',
  type,
});

type GrantRegiFormProps = {
  onCreated?: () => void;
  // Preselects a resident, e.g. when opened from their row in Registatus.
  initialUserId?: string;
  hideHeading?: boolean;
};

const GrantRegiForm: React.FC<GrantRegiFormProps> = ({
  onCreated,
  initialUserId = '',
  hideHeading = false,
}) => {
  const { user } = useAuth();
  const { categories, users, loading, message, setMessage, createGrantedLog } =
    useGrantRegiWorkflow();
  const [form, setForm] = useState<FormState>(() => emptyForm('', initialUserId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const selectedType =
    form.type ||
    categories.find((category) => category.name === 'Regi')?.name ||
    categories[0]?.name ||
    '';

  const setField = (k: keyof FormState, v: string) => {
    setForm((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
    setMessage(null);
    setSucceeded(false);
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'no')),
    [users]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    setSucceeded(false);

    const parsed = FormSchema.safeParse({ ...form, type: selectedType });

    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        map[issue.path[0] as string] = issue.message;
      });
      setErrors(map);
      return;
    }

    if (!user) return;

    try {
      setSubmitting(true);
      await createGrantedLog(
        {
          userId: parsed.data.userId,
          title: parsed.data.title,
          description: parsed.data.description,
          // Noon keeps the chosen calendar day regardless of time zone.
          date: new Date(`${parsed.data.date}T12:00:00`),
          hours: parsed.data.hours,
          type: parsed.data.type,
        },
        user.id
      );

      const recipient = users.find((candidate) => candidate.id === parsed.data.userId);
      setMessage(`Registrert og godkjent for ${recipient?.name ?? 'beboeren'}.`);
      setSucceeded(true);
      setForm(emptyForm(selectedType));
      onCreated?.();
    } catch (err) {
      console.error(err);
      setMessage(getErrorMessage(err, 'Kunne ikke registrere regi.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4" noValidate>
      {!hideHeading && (
        <div>
          <h2 className="text-lg font-semibold">Gi regitimer</h2>
          <p className="text-sm text-muted">
            Timene registreres og godkjennes med en gang, med deg som godkjenner.
          </p>
        </div>
      )}

      {message && (
        <StatusMessage
          tone={succeeded ? 'success' : 'error'}
          onDismiss={() => {
            setMessage(null);
            setSucceeded(false);
          }}
        >
          {message}
        </StatusMessage>
      )}

      <Field label="Beboer" required error={errors.userId}>
        {(field) => (
          <Select
            {...field}
            value={form.userId}
            onChange={(e) => setField('userId', e.target.value)}
            invalid={!!errors.userId}
            disabled={loading}
          >
            <option value="">{loading ? 'Laster beboere...' : 'Velg beboer'}</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Tittel" required error={errors.title}>
        {(field) => (
          <Input
            {...field}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            invalid={!!errors.title}
            placeholder="F.eks. Hjalp til på dugnad"
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Dato" required error={errors.date}>
          {(field) => (
            <Input
              {...field}
              type="date"
              max={today()}
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              invalid={!!errors.date}
            />
          )}
        </Field>
        <Field label="Timer" required error={errors.hours}>
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.25"
              value={form.hours}
              onChange={(e) => setField('hours', e.target.value)}
              invalid={!!errors.hours}
              placeholder="1,5"
            />
          )}
        </Field>
        <Field label="Arbeidets art" required error={errors.type}>
          {(field) => (
            <Select
              {...field}
              value={selectedType}
              onChange={(e) => setField('type', e.target.value)}
              invalid={!!errors.type}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Beskrivelse" required error={errors.description}>
        {(field) => (
          <Textarea
            {...field}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            invalid={!!errors.description}
            rows={3}
            placeholder="Hva ble gjort?"
          />
        )}
      </Field>

      <Button type="submit" size="lg" loading={submitting} disabled={loading}>
        Registrer og godkjenn
      </Button>
    </form>
  );
};

export default GrantRegiForm;
