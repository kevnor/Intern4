import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkApprovalModal from './WorkApprovalModal';
import type { PendingRegiApproval } from '../../../../shared/types/regi';

const createSignedImageUrls = vi.fn();

vi.mock('../../../../server/storage', () => ({
  createSignedImageUrls: (...args: unknown[]) => createSignedImageUrls(...args),
}));

const approval: PendingRegiApproval = {
  id: 'approval-1',
  userId: '11111111-1111-4111-8111-111111111111',
  userName: 'Kari Godkjenner',
  userEmail: 'kari@example.com',
  sourceType: 'misc',
  title: 'Regiarbeid',
  description: 'Dokumentert med bilder',
  category: 'Regi',
  hours: 2,
  date: new Date('2026-04-10T00:00:00.000Z'),
  createdAt: new Date('2026-04-11T10:00:00.000Z'),
  imagePaths: ['user/regi/one.png'],
};

describe('WorkApprovalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createSignedImageUrls.mockResolvedValue(['https://example.com/one.png']);
  });

  it('renders attached regi images', async () => {
    render(
      <WorkApprovalModal
        approval={approval}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(await screen.findByAltText('Opplastet bilde 1')).toHaveAttribute(
      'src',
      'https://example.com/one.png'
    );
  });

  it('approves with a comment and closes once saved', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <WorkApprovalModal
        approval={approval}
        onClose={onClose}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/kommentar til beboeren/i), 'Bra jobba');
    await user.click(screen.getByRole('button', { name: /godkjenn 2 t/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onApprove).toHaveBeenCalledWith('approval-1', 'Bra jobba');
  });

  it('rejects with the comment and stays open if saving fails', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(
      <WorkApprovalModal
        approval={approval}
        onClose={onClose}
        onApprove={vi.fn()}
        onReject={onReject}
      />
    );

    await user.type(screen.getByLabelText(/kommentar til beboeren/i), 'Mangler bilde');
    await user.click(screen.getByRole('button', { name: 'Avslå' }));

    await waitFor(() => expect(onReject).toHaveBeenCalledWith('approval-1', 'Mangler bilde'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
