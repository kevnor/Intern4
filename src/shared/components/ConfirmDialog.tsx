import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  confirmLabel,
  cancelLabel = 'Avbryt',
  tone = 'primary',
  loading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    closeOnBackdrop={!loading}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {children && <div className="text-sm text-muted">{children}</div>}
  </Modal>
);
