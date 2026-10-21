import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportProblemModal from './ReportProblemModal';

const renderModal = (onSubmit = vi.fn().mockResolvedValue(true)) => {
  const onClose = vi.fn();
  render(
    <ReportProblemModal roomNumber={214} busy={false} onSubmit={onSubmit} onClose={onClose} />
  );
  return { onSubmit, onClose };
};

describe('ReportProblemModal', () => {
  it('sends the report and closes', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal();

    await user.type(screen.getByLabelText(/Hva er problemet/), 'Ødelagt lås');
    await user.type(screen.getByLabelText(/Utfyllende beskrivelse/), 'Døra går ikke i lås');
    await user.click(screen.getByRole('button', { name: 'Send melding' }));

    expect(onSubmit).toHaveBeenCalledWith('Ødelagt lås', 'Døra går ikke i lås');
    expect(onClose).toHaveBeenCalled();
  });

  it('needs a title', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    expect(screen.getByRole('button', { name: 'Send melding' })).toBeDisabled();
    await user.type(screen.getByLabelText(/Hva er problemet/), '   ');
    expect(screen.getByRole('button', { name: 'Send melding' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stays open when sending fails', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(vi.fn().mockResolvedValue(false));

    await user.type(screen.getByLabelText(/Hva er problemet/), 'Lås');
    await user.click(screen.getByRole('button', { name: 'Send melding' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
