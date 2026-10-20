import React, { useEffect, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  StatusMessage,
  Textarea,
  controlClasses,
} from '../../../shared/components';
import { cn } from '../../../shared/utils/cn';
import { formatDateColumnValue } from '../../../shared/utils/date';
import {
  safeParseTaskFormData,
  TaskCreationData,
  TaskFormData,
  validateTaskCreationData,
} from '../../../shared/types/regi/tasks';
import { FormErrors, TaskCreationModalProps } from './types';

const TaskCreationModal: React.FC<TaskCreationModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  onUpdateTask,
  categories,
  currentUser,
  editingTask,
  contactPeople = [],
}) => {
  const isEditing = !!editingTask;
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    category: '',
    description: '',
    contactPersonId: '',
    deadline: '',
    hourEstimate: '',
    maxParticipants: '1',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [contactPersonQuery, setContactPersonQuery] = useState('');
  const formId = useId();

  // Deadlines are calendar dates; show the stored date (or a timestamp's Oslo date).
  const toDateInputValue = (value?: string | null): string => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : formatDateColumnValue(date);
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: editingTask?.title ?? '',
        category: editingTask?.category ?? (categories.length > 0 ? categories[0].name : ''),
        description: editingTask?.description ?? '',
        contactPersonId: editingTask?.contactPersonId ?? currentUser?.id ?? '',
        deadline: toDateInputValue(editingTask?.deadline),
        hourEstimate: editingTask?.hourEstimate != null ? String(editingTask.hourEstimate) : '',
        maxParticipants: String(editingTask?.maxParticipants ?? 1),
      });
      setErrors({});
      setContactPersonQuery('');
    }
  }, [isOpen, categories, currentUser?.id, editingTask]);

  const validateForm = (): boolean => {
    // First validate with Zod schema
    const result = safeParseTaskFormData(formData);

    if (!result.success) {
      const zodErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        zodErrors[field] = issue.message;
      });
      setErrors(zodErrors);
      return false;
    }

    // Additional custom validation
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Oppgavenavn er påkrevd';
    }

    if (!formData.category) {
      newErrors.category = 'Kategori er påkrevd';
    }

    if (!formData.hourEstimate) {
      newErrors.hourEstimate = 'Timeestimat er påkrevd';
    } else {
      const hours = Number(formData.hourEstimate);
      if (isNaN(hours) || hours <= 0) {
        newErrors.hourEstimate = 'Timeestimat må være et positivt tall';
      } else if (!Number.isInteger(hours)) {
        // work_tasks.time_estimate is a smallint column.
        newErrors.hourEstimate = 'Timeestimat må være et helt antall timer';
      }
    }

    if (!formData.maxParticipants) {
      newErrors.maxParticipants = 'Maksimalt antall deltakere er påkrevd';
    } else {
      const maxParticipants = Number(formData.maxParticipants);
      const joinedCount = editingTask?.participants.length ?? 0;
      if (isNaN(maxParticipants) || maxParticipants < 1) {
        newErrors.maxParticipants = 'Maksimalt antall deltakere må være minst 1';
      } else if (maxParticipants < joinedCount) {
        newErrors.maxParticipants = `Kan ikke være lavere enn antall påmeldte (${joinedCount})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const transformFormDataToCreationData = (formData: TaskFormData): TaskCreationData => {
    return {
      title: formData.title.trim(),
      category: formData.category,
      description: formData.description.trim() || undefined,
      contactPersonId: formData.contactPersonId || undefined,
      // Noon keeps the same calendar day in any nearby time zone.
      deadline: formData.deadline ? new Date(`${formData.deadline}T12:00:00`) : undefined,
      hourEstimate: Number(formData.hourEstimate),
      maxParticipants: Number(formData.maxParticipants),
    };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const taskCreationData = transformFormDataToCreationData(formData);

      // Validate the creation data with Zod
      const validatedData = validateTaskCreationData(taskCreationData);

      if (editingTask && onUpdateTask) {
        await onUpdateTask(editingTask.id, validatedData);
      } else {
        await onCreateTask(validatedData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      if (error instanceof Error) {
        setErrors({
          submit: `Kunne ikke ${isEditing ? 'oppdatere' : 'opprette'} oppgave: ${error.message}`,
        });
      } else {
        setErrors({
          submit: `Kunne ikke ${isEditing ? 'oppdatere' : 'opprette'} oppgave. Prøv igjen.`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof TaskFormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const selectedContactPerson =
    contactPeople.find((person) => person.id === formData.contactPersonId) ?? null;

  const filteredContactPeople = useMemo(() => {
    const normalizedQuery = contactPersonQuery.trim().toLowerCase();
    const matches = contactPeople.filter((person) => {
      if (!normalizedQuery) return true;

      return (
        person.name.toLowerCase().includes(normalizedQuery) ||
        (person.email ?? '').toLowerCase().includes(normalizedQuery)
      );
    });

    return matches.sort((a, b) => a.name.localeCompare(b.name, 'no'));
  }, [contactPeople, contactPersonQuery]);

  if (!isOpen) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      fullScreenOnMobile
      closeOnBackdrop={!isSubmitting}
      title={isEditing ? 'Rediger oppgave' : 'Opprett ny oppgave'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            {isEditing ? 'Lagre endringer' : 'Opprett oppgave'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errors.submit && <StatusMessage tone="error">{errors.submit}</StatusMessage>}

        <Field label="Oppgavenavn" required error={errors.title}>
          {(field) => (
            <Input
              {...field}
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              invalid={!!errors.title}
              placeholder="F.eks. Vaske storkjøkkenet"
            />
          )}
        </Field>

        <Field label="Kategori" required error={errors.category}>
          {(field) => (
            <Select
              {...field}
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              invalid={!!errors.category}
            >
              <option value="">Velg kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Beskrivelse">
          {(field) => (
            <Textarea
              {...field}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              placeholder="Hva skal gjøres, og hvor?"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Frist" className="sm:col-span-1">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={formData.deadline}
                onChange={(e) => handleInputChange('deadline', e.target.value)}
              />
            )}
          </Field>
          <Field label="Timeestimat" required error={errors.hourEstimate}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={formData.hourEstimate}
                onChange={(e) => handleInputChange('hourEstimate', e.target.value)}
                invalid={!!errors.hourEstimate}
                placeholder="F.eks. 2"
              />
            )}
          </Field>
          <Field
            label="Maksimalt antall deltakere"
            required
            error={errors.maxParticipants}
            hint={
              editingTask?.participants.length
                ? `${editingTask.participants.length} er påmeldt nå`
                : 'Minst 1'
            }
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={Math.max(editingTask?.participants.length ?? 0, 1)}
                value={formData.maxParticipants}
                onChange={(e) => handleInputChange('maxParticipants', e.target.value)}
                invalid={!!errors.maxParticipants}
              />
            )}
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-fg">Kontaktperson</legend>
          {selectedContactPerson && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-subtle px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary-subtle-fg">
                  {selectedContactPerson.name}
                </p>
                {selectedContactPerson.email && (
                  <p className="truncate text-xs text-primary-subtle-fg/80">
                    {selectedContactPerson.email}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleInputChange('contactPersonId', '')}
              >
                Fjern
              </Button>
            </div>
          )}
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
            />
            <input
              type="search"
              aria-label="Søk etter kontaktperson"
              value={contactPersonQuery}
              onChange={(e) => setContactPersonQuery(e.target.value)}
              className={controlClasses(false, 'min-h-10 py-2 pl-9')}
              placeholder="Søk etter navn eller e-post"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
            {filteredContactPeople.length > 0 ? (
              filteredContactPeople.map((person) => {
                const isSelected = person.id === formData.contactPersonId;

                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleInputChange('contactPersonId', person.id)}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-primary-subtle text-primary-subtle-fg'
                        : 'hover:bg-surface-muted'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{person.name}</span>
                      {person.email && (
                        <span className="block truncate text-xs text-subtle">{person.email}</span>
                      )}
                    </span>
                    {isSelected && <span className="ml-3 text-xs font-semibold">Valgt</span>}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-sm text-subtle">Ingen aktive brukere matcher søket.</p>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};

export default TaskCreationModal;
