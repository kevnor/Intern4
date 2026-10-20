import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SemesterHoursCard from './SemesterHoursCard';
import { getRequiredHours, setRequiredHours } from '../../../../server/dao/semesterSettingsDAO';

describe('SemesterHoursCard', () => {
  beforeEach(() => {
    vi.mocked(getRequiredHours).mockResolvedValue(40);
    vi.mocked(setRequiredHours).mockClear();
  });

  it('shows the configured hours and saves a new value', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<SemesterHoursCard onSaved={onSaved} />);

    const input = await screen.findByLabelText('Timer per semester');
    await waitFor(() => expect(input).toHaveValue(40));
    expect(screen.getByRole('button', { name: 'Lagre' })).toBeDisabled();

    await user.clear(input);
    await user.type(input, '36');
    await user.click(screen.getByRole('button', { name: 'Lagre' }));

    await waitFor(() => expect(setRequiredHours).toHaveBeenCalledWith(expect.any(String), 36));
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findByText('Timekravet er lagret.')).toBeInTheDocument();
  });

  it('rejects an empty value', async () => {
    const user = userEvent.setup();
    render(<SemesterHoursCard />);

    const input = await screen.findByLabelText('Timer per semester');
    await waitFor(() => expect(input).toHaveValue(40));
    await user.clear(input);

    expect(screen.getByText('Skriv inn et tall på 0 eller mer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lagre' })).toBeDisabled();
  });
});
