import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Modal, StatusMessage } from '../../../shared/components';
import { isLocalLoginEnabled } from '../../auth/config';
import { AUTH_PATHS } from '../../auth/paths';
import { buildWelcomeText } from '../welcomeText';
import type { CreatedUser } from './NewUserModal';

// What to pass on to the resident. With Microsoft sign-in there is nothing secret to hand over; the
// temporary password is only ever shown here (and only while email and password is on), so the
// dialog stays until the admin closes it.
const CreatedUserDialog: React.FC<{
  user: CreatedUser | null;
  onClose: () => void;
  title?: string;
}> = ({ user, onClose, title = 'Bruker opprettet' }) => {
  const [copied, setCopied] = useState(false);
  const [welcomeCopied, setWelcomeCopied] = useState(false);

  if (!user) return null;

  const password = isLocalLoginEnabled() ? user.initialPassword : undefined;
  const welcome = buildWelcomeText({
    name: user.name,
    email: user.email,
    loginUrl: `${window.location.origin}${AUTH_PATHS.LOGIN}`,
    initialPassword: password,
  });

  const copy = async (text: string, done: (copied: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
    } catch {
      done(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={false}
      footer={<Button onClick={onClose}>Ferdig</Button>}
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          <span className="font-medium text-fg">{user.name}</span> kan nå logge inn med
          Microsoft-kontoen <span className="font-medium text-fg">{user.email}</span>
          {password ? ', eller med e-post og dette midlertidige passordet:' : '.'}
        </p>
        {password && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted p-2 pl-4">
              <code
                aria-label="Midlertidig passord"
                className="flex-1 select-all break-all font-mono text-base tracking-wide"
              >
                {password}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copy(password, setCopied)}
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
        <div className="space-y-2">
          <p className="font-medium">Melding til beboeren</p>
          <pre
            aria-label="Velkomstmelding"
            className="whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-muted p-3 font-sans text-sm"
          >
            {welcome}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy(welcome, setWelcomeCopied)}
            icon={
              welcomeCopied ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4" />
              )
            }
          >
            {welcomeCopied ? 'Melding kopiert' : 'Kopier meldingen'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreatedUserDialog;
