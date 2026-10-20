import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Edit2, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  SearchInput,
  Spinner,
  StatusMessage,
  Textarea,
} from '../../../shared/components';
import {
  Category,
  CategoryCreationData,
  CategoryFormData,
} from '../../../shared/types/regi/tasks/category.types';
import { cn } from '../../../shared/utils/cn';

type FormErrors = Record<string, string>;

type CategoryManagementProps = {
  categories: Category[];
  onAddCategory: (categoryData: CategoryCreationData) => Promise<void>;
  onUpdateCategory: (categoryId: string, categoryData: Partial<Category>) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  getCategoryUsage: (categoryId: string) => Promise<number>;
  onClose: () => void;
};

// Chosen to stay distinguishable from each other and readable as dots in both themes.
const PRESET_COLORS: { value: string; name: string }[] = [
  { value: '#8B1E3F', name: 'Burgunder' },
  { value: '#0F766E', name: 'Petrol' },
  { value: '#D97706', name: 'Rav' },
  { value: '#4F46E5', name: 'Indigo' },
  { value: '#BE185D', name: 'Rosa' },
  { value: '#15803D', name: 'Grønn' },
  { value: '#0369A1', name: 'Blå' },
  { value: '#57534E', name: 'Grå' },
];
const DEFAULT_COLOR = PRESET_COLORS[0].value;

type UsageState = { counts: Record<string, number>; failed: Set<string>; loading: boolean };

const CategoryManagement: React.FC<CategoryManagementProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  getCategoryUsage,
  onClose,
}) => {
  const formId = useId();
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: DEFAULT_COLOR,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<UsageState>({
    counts: {},
    failed: new Set(),
    loading: true,
  });
  const [query, setQuery] = useState<string>('');
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void Promise.all(
      categories.map(async (category) => {
        try {
          return { id: category.id, count: await getCategoryUsage(category.id) };
        } catch (error) {
          console.error(`Error loading usage for category ${category.name}:`, error);
          return { id: category.id, count: null };
        }
      })
    ).then((results) => {
      if (!isCurrent) return;
      const counts: Record<string, number> = {};
      const failed = new Set<string>();
      results.forEach(({ id, count }) => {
        if (count === null) failed.add(id);
        else counts[id] = count;
      });
      setUsage({ counts, failed, loading: false });
    });

    return () => {
      isCurrent = false;
    };
  }, [categories, getCategoryUsage]);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return categories;
    }

    return categories.filter(
      (category) =>
        category.name.toLowerCase().includes(normalizedQuery) ||
        (category.description ?? '').toLowerCase().includes(normalizedQuery)
    );
  }, [categories, query]);

  const resetForm = (): void => {
    setFormData({ name: '', description: '', color: DEFAULT_COLOR });
    setErrors({});
  };

  const startAdd = (): void => {
    resetForm();
    setEditingCategory(null);
    setIsAddingCategory(true);
  };

  const startEdit = (category: Category): void => {
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
    });
    setEditingCategory(category);
    setIsAddingCategory(false);
    setErrors({});
  };

  const cancelEdit = (): void => {
    setIsAddingCategory(false);
    setEditingCategory(null);
    resetForm();
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Kategorinavn er påkrevd';
    } else {
      const existingCategory = categories.find(
        (cat) =>
          cat.name.toLowerCase() === formData.name.trim().toLowerCase() &&
          cat.id !== editingCategory?.id
      );
      if (existingCategory) {
        newErrors.name = 'En kategori med dette navnet eksisterer allerede';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
        });
      } else {
        await onAddCategory({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
          isActive: true,
        });
      }
      cancelEdit();
    } catch (error) {
      console.error('Error saving category:', error);
      setErrors({ submit: 'Kunne ikke lagre kategori. Prøv igjen.' });
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (category: Category): void => {
    setNotice(null);

    if (usage.failed.has(category.id)) {
      setNotice(
        `Kunne ikke sjekke om kategorien «${category.name}» er i bruk, så den kan ikke slettes nå. Prøv igjen senere.`
      );
      return;
    }

    const count = usage.counts[category.id] ?? 0;
    if (count > 0) {
      setNotice(
        `Kan ikke slette kategorien «${category.name}» fordi den brukes av ${count} oppgave${count !== 1 ? 'r' : ''}.`
      );
      return;
    }

    setPendingDelete(category);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await onDeleteCategory(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      setPendingDelete(null);
      setNotice('Kunne ikke slette kategori. Prøv igjen.');
    } finally {
      setDeleting(false);
    }
  };

  const handleFormDataChange = (field: keyof CategoryFormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const isFormOpen = isAddingCategory || !!editingCategory;
  const isPresetColor = PRESET_COLORS.some(
    (color) => color.value.toLowerCase() === formData.color.toLowerCase()
  );

  return (
    <>
      <Modal open onClose={onClose} title="Kategorier" size="lg" fullScreenOnMobile>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Søk i kategorier..."
              label="Søk i kategorier"
              className="flex-1"
            />
            <Button icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={startAdd}>
              Ny kategori
            </Button>
          </div>

          {notice && (
            <StatusMessage tone="error" onDismiss={() => setNotice(null)}>
              {notice}
            </StatusMessage>
          )}

          {usage.loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-subtle">
              <Spinner label="Laster kategorier..." />
              Laster kategorier...
            </div>
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">Ingen kategorier opprettet</p>
          ) : filteredCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">Ingen kategorier matcher søket</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {filteredCategories.map((category) => {
                const count = usage.counts[category.id];

                return (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-3 px-4 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 rounded-full ring-1 ring-border-strong"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="min-w-0 leading-tight">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="truncate text-sm font-medium">{category.name}</h3>
                          <span className="text-xs text-subtle">
                            {count === undefined
                              ? 'Ukjent bruk'
                              : `${count} oppgave${count !== 1 ? 'r' : ''}`}
                          </span>
                        </div>
                        {category.description && (
                          <p className="truncate text-xs text-subtle">{category.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-subtle hover:bg-surface-muted hover:text-fg"
                        title="Rediger kategori"
                        aria-label={`Rediger ${category.name}`}
                      >
                        <Edit2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(category)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-subtle hover:bg-danger-subtle hover:text-danger"
                        title="Slett kategori"
                        aria-label={`Slett ${category.name}`}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={isFormOpen}
        onClose={cancelEdit}
        title={editingCategory ? 'Rediger kategori' : 'Ny kategori'}
        closeOnBackdrop={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Avbryt
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editingCategory ? 'Lagre endringer' : 'Legg til'}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errors.submit && <StatusMessage tone="error">{errors.submit}</StatusMessage>}

          <Field label="Kategorinavn" required error={errors.name}>
            {(field) => (
              <Input
                {...field}
                type="text"
                value={formData.name}
                onChange={(e) => handleFormDataChange('name', e.target.value)}
                invalid={!!errors.name}
                placeholder="F.eks. Strøm"
              />
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium">Farge</legend>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((color) => {
                const selected = color.value.toLowerCase() === formData.color.toLowerCase();
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleFormDataChange('color', color.value)}
                    aria-label={color.name}
                    aria-pressed={selected}
                    title={color.name}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-surface-raised transition',
                      selected ? 'ring-2 ring-fg' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: color.value }}
                  >
                    {selected && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
                  </button>
                );
              })}
              <label
                className={cn(
                  'relative flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input px-3 text-sm',
                  !isPresetColor && 'ring-2 ring-fg ring-offset-2 ring-offset-surface-raised'
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full ring-1 ring-border-strong"
                  style={{ backgroundColor: formData.color }}
                />
                Egen
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleFormDataChange('color', e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Velg egen farge"
                />
              </label>
            </div>
          </fieldset>

          <Field label="Beskrivelse">
            {(field) => (
              <Textarea
                {...field}
                value={formData.description}
                onChange={(e) => handleFormDataChange('description', e.target.value)}
                rows={3}
                placeholder="Valgfri beskrivelse av kategorien..."
              />
            )}
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Slette kategorien?"
        confirmLabel="Slett"
        tone="danger"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        Kategorien «{pendingDelete?.name}» blir fjernet fra listen.
      </ConfirmDialog>
    </>
  );
};

export default CategoryManagement;
