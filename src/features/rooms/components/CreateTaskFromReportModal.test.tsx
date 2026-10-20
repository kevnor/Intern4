import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTaskFromReportModal from './CreateTaskFromReportModal';
import { getCategories } from '../../../server/dao/categoriesDAO';
import type { RoomReport } from '../types';

vi.mock('../../../server/dao/categoriesDAO', () => ({ getCategories: vi.fn() }));

const report: RoomReport = {
  id: 'rep1',
  roomId: 'room',
  roomNumber: 214,
  reportedBy: 'u1',
  reporterName: 'Anne Hansen',
  title: 'Ødelagt lås',
  description: 'Døra går ikke i lås.',
  status: 'open',
  workItemId: null,
  createdAt: new Date(2026, 9, 1),
  resolvedAt: null,
};

const category = (id: string, name: string) => ({
  id,
  name,
  description: '',
  color: 'gray',
  isActive: true,
  createdAt: new Date(0),
});

const renderModal = (onCreate = vi.fn().mockResolvedValue(true)) => {
  const onClose = vi.fn();
  render(
    <CreateTaskFromReportModal report={report} busy={false} onCreate={onCreate} onClose={onClose} />
  );
  return { onCreate, onClose };
};

describe('CreateTaskFromReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([
      category('1', 'Hage'),
      category('2', 'Vedlikehold'),
    ]);
  });

  it('is filled in from the report and prefers the Vedlikehold category', async () => {
    renderModal();

    expect(screen.getByLabelText(/Tittel/)).toHaveValue('Rom 214: Ødelagt lås');
    expect(screen.getByLabelText('Beskrivelse')).toHaveValue(
      'Døra går ikke i lås.\n\nMeldt av Anne Hansen (rom 214).'
    );
    await waitFor(() => expect(screen.getByLabelText(/Kategori/)).toHaveValue('Vedlikehold'));
  });

  it('creates the task with the chosen details and closes', async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = renderModal();
    await waitFor(() => expect(screen.getByLabelText(/Kategori/)).toHaveValue('Vedlikehold'));

    await user.selectOptions(screen.getByLabelText(/Kategori/), 'Hage');
    await user.clear(screen.getByLabelText('Timer'));
    await user.type(screen.getByLabelText('Timer'), '3');
    await user.clear(screen.getByLabelText('Antall deltakere'));
    await user.type(screen.getByLabelText('Antall deltakere'), '2');
    await user.click(screen.getByRole('button', { name: 'Opprett oppgave' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith('rep1', {
        title: 'Rom 214: Ødelagt lås',
        category: 'Hage',
        description: 'Døra går ikke i lås.\n\nMeldt av Anne Hansen (rom 214).',
        deadline: undefined,
        hourEstimate: 3,
        maxParticipants: 2,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('cannot be created without a title or with zero hours', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByLabelText(/Kategori/)).toHaveValue('Vedlikehold'));

    await user.clear(screen.getByLabelText(/Tittel/));
    expect(screen.getByRole('button', { name: 'Opprett oppgave' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Tittel/), 'Lås');
    await user.clear(screen.getByLabelText('Timer'));
    await user.type(screen.getByLabelText('Timer'), '0');
    expect(screen.getByRole('button', { name: 'Opprett oppgave' })).toBeDisabled();
  });

  it('stays open when creating fails', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(vi.fn().mockResolvedValue(false));
    await waitFor(() => expect(screen.getByLabelText(/Kategori/)).toHaveValue('Vedlikehold'));

    await user.click(screen.getByRole('button', { name: 'Opprett oppgave' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
