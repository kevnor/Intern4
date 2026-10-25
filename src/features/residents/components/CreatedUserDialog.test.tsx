import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreatedUserDialog from './CreatedUserDialog';

const user = { name: 'Kari Nordmann', email: 'kari@example.no', initialPassword: 'Abc123xyz789' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('CreatedUserDialog', () => {
  it('gives a message to pass on, with the temporary password while email and password is on', () => {
    render(<CreatedUserDialog user={user} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Bruker opprettet' });
    expect(within(dialog).getByLabelText('Midlertidig passord')).toHaveTextContent('Abc123xyz789');
    expect(within(dialog).getByLabelText('Velkomstmelding')).toHaveTextContent(
      'Trykk «Logg inn med Microsoft»'
    );
    expect(within(dialog).getByLabelText('Velkomstmelding')).toHaveTextContent('Abc123xyz789');
  });

  it('shows no password at all once email and password is switched off', () => {
    vi.stubEnv('VITE_LOCAL_LOGIN_ENABLED', 'false');
    render(<CreatedUserDialog user={user} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Bruker opprettet' });
    expect(within(dialog).queryByLabelText('Midlertidig passord')).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent('Abc123xyz789');
    expect(within(dialog).getByLabelText('Velkomstmelding')).toHaveTextContent(
      `${window.location.origin}/login`
    );
  });

  it('copies the message', async () => {
    const click = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<CreatedUserDialog user={user} onClose={vi.fn()} />);

    await click.click(screen.getByRole('button', { name: 'Kopier meldingen' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Hei Kari!'));
    expect(await screen.findByRole('button', { name: 'Melding kopiert' })).toBeInTheDocument();
  });
});
