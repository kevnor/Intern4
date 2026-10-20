import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CategoryManagement from './CategoryManagement';
import type { Category } from '../../../shared/types/regi/tasks';

const categories: Category[] = [
  {
    id: 'category-1',
    name: 'Dataarbeid',
    description: 'Oppgaver med IT og systemer',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date('2026-04-10T10:00:00.000Z'),
  },
  {
    id: 'category-2',
    name: 'Vask',
    description: 'Rydding og renhold',
    color: '#10B981',
    isActive: true,
    createdAt: new Date('2026-04-11T10:00:00.000Z'),
  },
];

const renderCategoryManagement = (
  overrides: Partial<ComponentProps<typeof CategoryManagement>> = {}
) => {
  const props = {
    categories,
    onAddCategory: vi.fn().mockResolvedValue(undefined),
    onUpdateCategory: vi.fn().mockResolvedValue(undefined),
    onDeleteCategory: vi.fn().mockResolvedValue(undefined),
    getCategoryUsage: vi.fn().mockImplementation((categoryId: string) => {
      const counts: Record<string, number> = {
        'category-1': 3,
        'category-2': 0,
      };

      return Promise.resolve(counts[categoryId] ?? 0);
    }),
    onClose: vi.fn(),
    ...overrides,
  };

  render(<CategoryManagement {...props} />);

  return props;
};

describe('CategoryManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a modal with compact category rows and usage counts', async () => {
    renderCategoryManagement();

    expect(screen.getByRole('dialog', { name: 'Kategorier' })).toBeInTheDocument();
    expect(await screen.findByText('Dataarbeid')).toBeInTheDocument();
    expect(screen.getByText('3 oppgaver')).toBeInTheDocument();
    expect(screen.getByText('Vask')).toBeInTheDocument();
    expect(screen.getByText('0 oppgaver')).toBeInTheDocument();

    const row = screen.getByText('Dataarbeid').closest('li');
    expect(row).toHaveClass('py-2');
    expect(screen.getByRole('button', { name: 'Rediger Dataarbeid' })).toHaveClass('h-10', 'w-10');
    expect(screen.getByRole('button', { name: 'Slett Dataarbeid' })).toHaveClass('h-10', 'w-10');
  });

  it('filters categories by search query', async () => {
    const user = userEvent.setup();
    renderCategoryManagement();

    await screen.findByText('Dataarbeid');
    await user.type(screen.getByPlaceholderText(/søk i kategorier/i), 'vask');

    expect(screen.queryByText('Dataarbeid')).not.toBeInTheDocument();
    expect(screen.getByText('Vask')).toBeInTheDocument();
  });

  it('closes when clicking the backdrop but not when clicking inside the dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCategoryManagement({ onClose });

    const dialog = screen.getByRole('dialog', { name: 'Kategorier' });
    await screen.findByText('Dataarbeid');
    await user.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the category form when clicking the form backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCategoryManagement({ onClose });

    await screen.findByText('Dataarbeid');
    await user.click(screen.getByRole('button', { name: 'Rediger Vask' }));

    const formDialog = screen.getByRole('dialog', { name: 'Rediger kategori' });
    await user.click(formDialog.parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Rediger kategori' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Kategorier', hidden: true })).toBeInTheDocument();
  });

  it('adds a category with trimmed form data', async () => {
    const user = userEvent.setup();
    const onAddCategory = vi.fn().mockResolvedValue(undefined);
    renderCategoryManagement({ onAddCategory });

    await screen.findByText('Dataarbeid');
    await user.click(screen.getByRole('button', { name: /ny kategori/i }));

    await user.type(screen.getByLabelText(/kategorinavn/i), '  Strøm  ');
    await user.type(screen.getByLabelText(/beskrivelse/i), '  Elektrisk arbeid  ');
    await user.click(screen.getByRole('button', { name: 'Legg til' }));

    await waitFor(() => {
      expect(onAddCategory).toHaveBeenCalledWith({
        name: 'Strøm',
        description: 'Elektrisk arbeid',
        color: '#8B1E3F',
        isActive: true,
      });
    });
    expect(screen.queryByRole('dialog', { name: 'Ny kategori' })).not.toBeInTheDocument();
  });

  it('updates the selected category', async () => {
    const user = userEvent.setup();
    const onUpdateCategory = vi.fn().mockResolvedValue(undefined);
    renderCategoryManagement({ onUpdateCategory });

    await screen.findByText('Dataarbeid');
    await user.click(screen.getByRole('button', { name: 'Rediger Vask' }));

    const formDialog = screen.getByRole('dialog', { name: 'Rediger kategori' });
    const nameInput = within(formDialog).getByLabelText(/kategorinavn/i);
    await user.clear(nameInput);
    await user.type(nameInput, '  Kjøkken  ');
    await user.click(within(formDialog).getByRole('button', { name: 'Lagre endringer' }));

    await waitFor(() => {
      expect(onUpdateCategory).toHaveBeenCalledWith('category-2', {
        name: 'Kjøkken',
        description: 'Rydding og renhold',
        color: '#10B981',
      });
    });
  });

  it('blocks duplicate category names', async () => {
    const user = userEvent.setup();
    const onAddCategory = vi.fn().mockResolvedValue(undefined);
    renderCategoryManagement({ onAddCategory });

    await screen.findByText('Dataarbeid');
    await user.click(screen.getByRole('button', { name: /ny kategori/i }));
    await user.type(screen.getByLabelText(/kategorinavn/i), 'dataarbeid');
    await user.click(screen.getByRole('button', { name: 'Legg til' }));

    expect(
      await screen.findByText('En kategori med dette navnet eksisterer allerede')
    ).toBeInTheDocument();
    expect(onAddCategory).not.toHaveBeenCalled();
  });

  it('does not delete a category that is used by tasks', async () => {
    const user = userEvent.setup();
    const onDeleteCategory = vi.fn().mockResolvedValue(undefined);

    renderCategoryManagement({ onDeleteCategory });

    await screen.findByText('3 oppgaver');
    await user.click(screen.getByRole('button', { name: 'Slett Dataarbeid' }));

    expect(
      screen.getByText('Kan ikke slette kategorien «Dataarbeid» fordi den brukes av 3 oppgaver.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Slette kategorien?' })).not.toBeInTheDocument();
    expect(onDeleteCategory).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting an unused category', async () => {
    const user = userEvent.setup();
    const onDeleteCategory = vi.fn().mockResolvedValue(undefined);

    renderCategoryManagement({ onDeleteCategory });

    await screen.findByText('0 oppgaver');
    await user.click(screen.getByRole('button', { name: 'Slett Vask' }));

    const confirm = screen.getByRole('dialog', { name: 'Slette kategorien?' });
    await user.click(within(confirm).getByRole('button', { name: 'Slett' }));

    await waitFor(() => expect(onDeleteCategory).toHaveBeenCalledWith('category-2'));
  });

  it('blocks deleting when the usage lookup fails', async () => {
    const user = userEvent.setup();
    const onDeleteCategory = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderCategoryManagement({
      onDeleteCategory,
      getCategoryUsage: vi.fn().mockRejectedValue(new Error('nettverksfeil')),
    });

    expect(await screen.findAllByText('Ukjent bruk')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Slett Vask' }));

    expect(
      screen.getByText(/kunne ikke sjekke om kategorien «Vask» er i bruk/i)
    ).toBeInTheDocument();
    expect(onDeleteCategory).not.toHaveBeenCalled();
  });

  it('keeps the form open with an error when saving fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderCategoryManagement({
      onAddCategory: vi.fn().mockRejectedValue(new Error('feil')),
    });

    await screen.findByText('Dataarbeid');
    await user.click(screen.getByRole('button', { name: /ny kategori/i }));
    await user.type(screen.getByLabelText(/kategorinavn/i), 'Strøm');
    await user.click(screen.getByRole('button', { name: 'Legg til' }));

    expect(await screen.findByText('Kunne ikke lagre kategori. Prøv igjen.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ny kategori' })).toBeInTheDocument();
    expect(screen.getByLabelText(/kategorinavn/i)).toHaveValue('Strøm');
  });
});
