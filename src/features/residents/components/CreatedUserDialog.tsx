import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Modal, StatusMessage } from '../../../shared/components';
import type { CreatedUser } from './NewUserModal';

// The temporary password is only ever shown here, so it stays until the admin closes it.
const CreatedUserDialog: React.FC<{ user: CreatedUser | null; onClose: () => void }> = ({
  user,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(user.initialPassword ?? '');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Bruker opprettet"
      size="sm"
      closeOnBackdrop={false}
      footer={<Button onClick={onClose}>Ferdig</Button>}
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          <span className="font-medium text-fg">{user.name}</span> kan nå logge inn med{' '}
          <span className="font-medium text-fg">{user.email}</span>
          {user.initialPassword ? ' og dette midlertidige passordet:' : '.'}
        </p>
        {user.initialPassword && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted p-2 pl-4">
              <code
                aria-label="Midlertidig passord"
                className="flex-1 select-all break-all font-mono text-base tracking-wide"
              >
                {user.initialPassword}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copy()}
                icon={
                  copied ? (
                    <Check aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Copy aria-hidden="true" className="h-4 w-4" />
                  )
                }
              >
                {copied ? 'Kopiert' : 'Kopier'}
              </Button>
            </div>
            <StatusMessage tone="warning">
              Passordet vises bare nå. Be brukeren bytte det etter første innlogging.
            </StatusMessage>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CreatedUserDialog;
