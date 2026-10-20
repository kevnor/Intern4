import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { z } from 'zod';
import { RegiLogSchema, WorkTypeSchema } from '../../../../shared/types/regi';
import { useAuth } from '../../../../app/providers/AuthContext';
import type { useWorkLogFormWorkflow } from '../hooks/useWorkLogFormWorkflow';
import {
  Button,
  Field,
  Input,
  Select,
  StatusMessage,
  Textarea,
} from '../../../../shared/components';
import { formatDateColumnValue } from '../../../../shared/utils/date';
import { validateImageFile } from '../../../../server/storage';
import { cn } from '../../../../shared/utils/cn';

const today = () => formatDateColumnValue(new Date());

const FormSchema = z.object({
  title: z.string().trim().min(1, 'Skriv en kort tittel'),
  description: z.string().trim().min(1, 'Beskriv hva du gjorde'),
  date: z
    .string()
    .min(1, 'Velg dato')
    .refine((value) => value <= today(), 'Datoen kan ikke være i fremtiden'),
  hours: z.coerce.number().positive('Må være mer enn 0'),
  type: WorkTypeSchema,
  images: z.array(z.instanceof(File)).optional(),
});

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const emptyForm = (type = '') => ({
  title: '',
  description: '',
  date: today(),
  hours: '',
  type,
});

type WorkLogFormProps = ReturnType<typeof useWorkLogFormWorkflow> & {
  onCreated?: () => void;
  // Hidden when shown in a sheet, which has its own title.
  hideHeading?: boolean;
};

const WorkLogForm: React.FC<WorkLogFormProps> = ({
  categories,
  createWorkLog,
  onCreated,
  hideHeading = false,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Default to the general "Regi" category (or the first one) unless the user picked one.
  const selectedType =
    form.type ||
    categories.find((category) => category.name === 'Regi')?.name ||
    categories[0]?.name ||
    '';

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
      })),
    [files]
  );
  useEffect(() => () => previews.forEach(({ url }) => url && URL.revokeObjectURL(url)), [previews]);

  const setField = (key: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(false);
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  };

  const addFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setSuccess(false);

    const existingKeys = new Set(files.map(getFileKey));
    const accepted: File[] = [];
    for (const file of selectedFiles) {
      try {
        validateImageFile(file);
      } catch (validationError) {
        setErrors((current) => ({
          ...current,
          images: validationError instanceof Error ? validationError.message : 'Ugyldig fil.',
        }));
        continue;
      }
      if (!existingKeys.has(getFileKey(file))) accepted.push(file);
    }

    if (accepted.length === selectedFiles.length) {
      setErrors((current) => ({ ...current, images: '' }));
    }
    setFiles((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);
    const parsed = FormSchema.safeParse({ ...form, type: selectedType, images: files });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => (map[issue.path[0] as string] = issue.message));
      setErrors(map);
      return;
    }

    if (!user) return;

    try {
      setSubmitting(true);
      const payload = RegiLogSchema.parse({
        userId: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        // Noon keeps the chosen calendar day regardless of time zone.
        date: new Date(`${parsed.data.date}T12:00:00`),
        hours: parsed.data.hours,
        type: parsed.data.type,
        createdAt: new Date(),
        status: 'pending',
      });

      await createWorkLog(
        {
          userId: payload.userId,
          title: payload.title,
          description: payload.description,
          date: payload.date,
          hours: payload.hours,
          type: payload.type,
        },
        files
      );

      setForm(emptyForm(selectedType));
      setFiles([]);
      setSuccess(true);
      onCreated?.();
    } catch (submitError) {
      setErrors({
        form:
          submitError instanceof Error ? submitError.message : 'Kunne ikke registrere regiarbeid.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {!hideHeading && (
        <div>
          <h2 className="text-lg font-semibold">Registrer regi</h2>
          <p className="text-sm text-muted">Timene sendes til regisjefen for godkjenning.</p>
        </div>
      )}

      {success && (
        <StatusMessage tone="success" onDismiss={() => setSuccess(false)}>
          Registrert! Timene venter nå på godkjenning.
        </StatusMessage>
      )}
      {errors.form && <StatusMessage tone="error">{errors.form}</StatusMessage>}

      <Field label="Tittel" required error={errors.title}>
        {(field) => (
          <Input
            {...field}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            invalid={!!errors.title}
            placeholder="F.eks. Byttet lyspærer i 2. etasje"
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <Field label="Arbeidets art" required error={errors.type}>
        {(field) => (
          <Select
            {...field}
            value={selectedType}
            onChange={(e) => setField('type', e.target.value)}
            invalid={!!errors.type}
          >
            {categories.length === 0 && <option value="">Laster kategorier...</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Beskrivelse" required error={errors.description}>
        {(field) => (
          <Textarea
            {...field}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            invalid={!!errors.description}
            rows={3}
            placeholder="Hva gjorde du, og hvor?"
          />
        )}
      </Field>

      <div className="space-y-2">
        <span className="block text-sm font-medium">Bilder (valgfritt)</span>
        <label
          htmlFor="work-log-images"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring',
            dragging
              ? 'border-primary bg-primary-subtle'
              : 'border-border-strong bg-surface-muted hover:border-primary'
          )}
        >
          <ImagePlus aria-hidden="true" className="h-7 w-7 text-primary" />
          <span className="text-sm font-medium">Ta bilde eller velg fra galleriet</span>
          <span className="text-xs text-subtle">eller dra bilder hit · maks 20 MB per bilde</span>
          <input
            ref={fileInputRef}
            id="work-log-images"
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => addFiles(Array.from(e.target.files || []))}
            className="sr-only"
          />
        </label>
        {errors.images && <p className="text-xs font-medium text-danger">{errors.images}</p>}
        {previews.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map(({ file, url }) => (
              <li
                key={getFileKey(file)}
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-muted"
              >
                {url ? (
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="block truncate p-2 text-xs">{file.name}</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((currentFile) => getFileKey(currentFile) !== getFileKey(file))
                    )
                  }
                  className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={`Fjern ${file.name}`}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        {submitting ? 'Lagrer...' : 'Registrer timer'}
      </Button>
    </form>
  );
};

export default WorkLogForm;
