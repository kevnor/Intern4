import React from 'react';
import { Calendar, Clock, MessageSquare, Tag, Trash2 } from 'lucide-react';
import { RegiLogWithId } from '../../../../shared/types/regi';
import { Button, ImagePreviewGrid, Modal, WorkStatusBadge } from '../../../../shared/components';
import { formatDate, formatDateTime, formatHours } from '../../../../shared/utils/date';

type WorkLogDetailsModalProps = {
  log: RegiLogWithId | null;
  onClose: () => void;
  onDelete?: (log: RegiLogWithId) => void;
};

const WorkLogDetailsModal: React.FC<WorkLogDetailsModalProps> = ({ log, onClose, onDelete }) => {
  if (!log) return null;

  const details = [
    { icon: Calendar, label: 'Utført', value: formatDate(log.date) },
    { icon: Clock, label: 'Timer', value: formatHours(log.hours) },
    { icon: Tag, label: 'Type', value: log.type },
    { icon: Calendar, label: 'Registrert', value: formatDateTime(log.createdAt) },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      fullScreenOnMobile
      title={log.title || 'Regioppføring'}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <WorkStatusBadge status={log.status} />
          {log.sourceType === 'task' ? 'Oppgavebasert registrering' : 'Manuell registrering'}
        </span>
      }
      footer={
        <>
          {onDelete && (
            <Button
              variant="ghost"
              icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => onDelete(log)}
              className="text-danger hover:bg-danger-subtle hover:text-danger sm:mr-auto"
            >
              Slett
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Lukk
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {log.reviewerComment && (
          <div className="space-y-1 rounded-2xl border border-primary/25 bg-primary-subtle p-4 text-primary-subtle-fg">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare aria-hidden="true" className="h-4 w-4" />
              Kommentar fra regisjef
            </div>
            <p className="whitespace-pre-wrap text-sm">{log.reviewerComment}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted p-4">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Beskrivelse</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">
            {log.description || 'Ingen beskrivelse.'}
          </p>
        </section>

        <ImagePreviewGrid paths={log.imagePaths} title="Bilder" />
      </div>
    </Modal>
  );
};

export default WorkLogDetailsModal;
