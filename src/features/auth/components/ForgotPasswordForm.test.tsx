import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ForgotPasswordForm from './ForgotPasswordForm';
import { forgotPassword } from '../../../server/dao/authentication';

vi.mock('../../../server/dao/authentication', () => ({
  forgotPassword: vi.fn().mockResolvedValue({ success: true }),
}));

describe('ForgotPasswordForm', () => {
  it('confirms the request and rate-limits resending', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ForgotPasswordForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('E-post'), 'ola@example.test');
    await user.click(screen.getByRole('button', { name: 'Send tilbakestillingslenke' }));

    expect(forgotPassword).toHaveBeenCalledWith('ola@example.test');
    expect(await screen.findByText(/vil du motta en e-post/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send på nytt \(60s\)/i })).toBeDisabled();
  });
});
