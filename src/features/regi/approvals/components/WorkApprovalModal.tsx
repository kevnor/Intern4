import React, { useState } from 'react';
import { Ban, Calendar, Check, Clock, User } from 'lucide-react';
import { PendingRegiApproval } from '../../../../shared/types/regi';
import { formatDate, formatDateTime, formatHours } from '../../../../shared/utils/date';
import {
  Badge,
  Button,
  CategoryBadge,
  Field,
  ImagePreviewGrid,
  Modal,
  Textarea,
} from '../../../../shared/components';

interface WorkApprovalModalProps {
  approval: PendingRegiApproval | null;
  onClose: () => void;
  onApprove: (assignmentId: string, comment?: string) => Promise<boolean>;
  onReject: (assignmentId: string, comment?: string) => Promise<boolean>;
  isProcessing?: boolean;
  categoryColor?: string;
}

const WorkApprovalModal: React.FC<WorkApprovalModalProps> = ({
  approval,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
  categoryColor,
}) => {
  const [comment, setComment] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  if (!approval) return null;

  // The list hook reports failures; the sheet only closes once the decision is saved.
  const decide = async (action: 'approve' | 'reject') => {
    setPendingAction(action);
    const decided =
      action === 'approve'
        ? await onApprove(approval.id, comment)
        : await onReject(approval.id, comment);
    setPendingAction(null);
    if (decided) onClose();
  };

  const details = [
    { icon: User, label: 'Beboer', value: approval.userName, sub: approval.userEmail },
    { icon: Clock, label: 'Timer', value: formatHours(approval.hours) },
    { icon: Calendar, label: 'Utført', value: formatDate(approval.date) },
    { icon: Calendar, label: 'Registrert', value: formatDateTime(approval.createdAt) },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      fullScreenOnMobile
      closeOnBackdrop={!isProcessing}
      title={approval.title || 'Godkjenn regi'}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <CategoryBadge name={approval.category} color={categoryColor} />
          {approval.sourceType === 'task' ? (
            <Badge tone="info">Oppgave</Badge>
          ) : (
            <Badge>Manuell registrering</Badge>
          )}
        </span>
      }
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void decide('reject')}
            disabled={isProcessing}
            loading={pendingAction === 'reject'}
            icon={<Ban aria-hidden="true" className="h-4 w-4" />}
            className="text-danger sm:mr-auto"
          >
            Avslå
          </Button>
          <Button
            variant="success"
            size="lg"
            onClick={() => void decide('approve')}
            disabled={isProcessing}
            loading={pendingAction === 'approve'}
            icon={<Check aria-hidden="true" className="h-4 w-4" />}
          >
            Godkjenn {formatHours(approval.hours)}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted p-4">
          {details.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted">{label}</dt>
                <dd className="text-sm">{value}</dd>
                {sub && <dd className="truncate text-xs text-subtle">{sub}</dd>}
              </div>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Beskrivelse</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">
            {approval.description || 'Ingen beskrivelse.'}
          </p>
        </section>

        <ImagePreviewGrid paths={approval.imagePaths} title="Bilder" />

        <Field label="Kommentar til beboeren" hint="Valgfritt. Vises i beboerens regilogg.">
          {(field) => (
            <Textarea
              {...field}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="F.eks. «Bra jobba!» eller hvorfor timene avslås"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
};

export default WorkApprovalModal;
