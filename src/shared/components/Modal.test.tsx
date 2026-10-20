import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';

const ModalHarness = ({ onClose = () => {} }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Åpne</button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Rediger oppgave"
        description="Endre detaljene"
        footer={<button>Lagre</button>}
      >
        <input aria-label="Tittel" />
      </Modal>
    </>
  );
};

describe('Modal', () => {
  it('renders a labelled dialog and focuses the first control', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Åpne' }));

    const dialog = screen.getByRole('dialog', { name: 'Rediger oppgave' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Endre detaljene');
    expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores focus and scrolling', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalHarness onClose={onClose} />);

    const opener = screen.getByRole('button', { name: 'Åpne' });
    await user.click(opener);
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Åpne' }));
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Tittel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Lagre' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('calls confirm and cancel handlers', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Slette føring?"
        confirmLabel="Slett"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Dette kan ikke angres.
      </ConfirmDialog>
    );

    expect(screen.getByRole('dialog', { name: 'Slette føring?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Slett' }));
    await user.click(screen.getByRole('button', { name: 'Avbryt' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
