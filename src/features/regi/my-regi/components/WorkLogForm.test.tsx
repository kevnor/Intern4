import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkLogForm from './WorkLogForm';
import type { Category } from '../../../../shared/types/regi/tasks';
import { formatDateColumnValue } from '../../../../shared/utils/date';

const USER_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('../../../../app/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID, role: 'Halv/Halv' } }),
}));

const categories: Category[] = [
  {
    id: '1',
    name: 'Regi',
    color: '#8B1E3F',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const renderForm = (createWorkLog = vi.fn().mockResolvedValue(undefined), onCreated = vi.fn()) => {
  render(
    <WorkLogForm categories={categories} createWorkLog={createWorkLog} onCreated={onCreated} />
  );
  return { createWorkLog, onCreated };
};

describe('WorkLogForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults the date to today's date in Oslo and blocks future dates", async () => {
    const user = userEvent.setup();
    const { createWorkLog } = renderForm();

    const dateInput = screen.getByLabelText(/dato/i);
    expect(dateInput).toHaveValue(formatDateColumnValue(new Date()));

    await user.type(screen.getByLabelText(/tittel/i), 'Måkte snø');
    await user.type(screen.getByLabelText(/timer/i), '1');
    await user.type(screen.getByLabelText(/beskrivelse/i), 'Foran inngangen');
    await user.clear(dateInput);
    await user.type(dateInput, '2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Registrer timer' }));

    expect(await screen.findByText('Datoen kan ikke være i fremtiden')).toBeInTheDocument();
    expect(createWorkLog).not.toHaveBeenCalled();
  });

  it('submits the chosen calendar day and confirms', async () => {
    const user = userEvent.setup();
    const { createWorkLog, onCreated } = renderForm();

    await user.type(screen.getByLabelText(/tittel/i), '  Byttet lyspærer  ');
    const dateInput = screen.getByLabelText(/dato/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-03-05');
    await user.type(screen.getByLabelText(/timer/i), '1.5');
    await user.type(screen.getByLabelText(/beskrivelse/i), 'Gangen i 2. etasje');
    await user.click(screen.getByRole('button', { name: 'Registrer timer' }));

    await waitFor(() =>
      expect(createWorkLog).toHaveBeenCalledWith(
        {
          userId: USER_ID,
          title: 'Byttet lyspærer',
          description: 'Gangen i 2. etasje',
          date: new Date('2026-03-05T12:00:00'),
          hours: 1.5,
          type: 'Regi',
        },
        []
      )
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/registrert! timene venter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tittel/i)).toHaveValue('');
  });

  it('rejects non-image files when they are picked', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(
      screen.getByLabelText(/ta bilde eller velg/i),
      new File(['x'], 'notater.txt', { type: 'text/plain' })
    );

    expect(screen.getByText('notater.txt er ikke et bilde.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fjern notater.txt/i })).not.toBeInTheDocument();
  });

  it('shows the error and keeps the input when saving fails', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockRejectedValue(new Error('Nettverksfeil')));

    await user.type(screen.getByLabelText(/tittel/i), 'Rydding');
    await user.type(screen.getByLabelText(/timer/i), '2');
    await user.type(screen.getByLabelText(/beskrivelse/i), 'Kjelleren');
    await user.click(screen.getByRole('button', { name: 'Registrer timer' }));

    expect(await screen.findByText('Nettverksfeil')).toBeInTheDocument();
    expect(screen.getByLabelText(/tittel/i)).toHaveValue('Rydding');
  });
});
