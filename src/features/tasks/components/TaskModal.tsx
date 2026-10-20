import React, { useState } from 'react';
import { Calendar, Clock, Pencil, Trash2, User, Users } from 'lucide-react';
import {
  Button,
  CategoryBadge,
  ConfirmDialog,
  Modal,
  StatusMessage,
  TaskAssignmentBadge,
} from '../../../shared/components';
import { getTaskWorkflowState } from '../../../shared/types/regi/tasks';
import { canManageTasks, canViewAllParticipants } from '../permissions';
import { TaskModalProps } from './types';
import { formatDeadline } from '../../../shared/utils/date';
import { ParticipantMeter } from './TaskCard';

const participantStatusMessages = {
  joined: { tone: 'info', text: 'Du er påmeldt. Send inn når oppgaven er gjort.' },
  submitted: { tone: 'warning', text: 'Sendt inn – venter på godkjenning.' },
  approved: { tone: 'success', text: 'Godkjent som regi.' },
  rejected: { tone: 'error', text: 'Avslått. Du kan sende inn på nytt.' },
} as const;

const TaskModal: React.FC<TaskModalProps> = ({
  task,
  onClose,
  currentUserId,
  userRole,
  categoryColor,
  onJoinTask,
  onLeaveTask,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  participantNames = {},
}) => {
  const [confirming, setConfirming] = useState<'complete' | 'delete' | null>(null);

  if (!task) return null;

  const { currentParticipant, participantCount, isFull, canJoin, canLeave, canSubmitCompletion } =
    getTaskWorkflowState(task, currentUserId);
  const canManage = canManageTasks(userRole);
  const statusMessage = currentParticipant
    ? participantStatusMessages[currentParticipant.status]
    : null;

  const details = [
    {
      icon: User,
      label: 'Kontaktperson',
      value: task.contactPersonId
        ? (participantNames[task.contactPersonId] ?? 'Ukjent bruker')
        : '–',
    },
    {
      icon: Calendar,
      label: 'Frist',
      value: formatDeadline(task.deadline),
    },
    {
      icon: Clock,
      label: 'Estimert tid',
      value: task.hourEstimate ? `${task.hourEstimate} timer` : 'Ikke spesifisert',
    },
    { icon: Users, label: 'Deltakere', value: <ParticipantMeter task={task} /> },
  ];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        fullScreenOnMobile
        title={task.title}
        description={<CategoryBadge name={task.category} color={categoryColor} />}
        footer={
          <>
            {canManage && (onEditTask || onDeleteTask) && (
              <div className="flex gap-2 sm:mr-auto">
                {onEditTask && (
                  <Button
                    variant="ghost"
                    icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => onEditTask(task)}
                    className="flex-1 sm:flex-none"
                  >
                    Rediger
                  </Button>
                )}
                {onDeleteTask && (
                  <Button
                    variant="ghost"
                    icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => setConfirming('delete')}
                    className="flex-1 text-danger hover:bg-danger-subtle hover:text-danger sm:flex-none"
                  >
                    Slett
                  </Button>
                )}
              </div>
            )}
            {canLeave && onLeaveTask && (
              <Button variant="secondary" onClick={() => onLeaveTask(task.id)}>
                Meld deg av
              </Button>
            )}
            {canSubmitCompletion && onCompleteTask && (
              <Button variant="success" onClick={() => setConfirming('complete')}>
                Send inn til godkjenning
              </Button>
            )}
            {canJoin && onJoinTask && (
              <Button onClick={() => onJoinTask(task.id)}>Meld deg på</Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          {statusMessage && (
            <StatusMessage tone={statusMessage.tone}>{statusMessage.text}</StatusMessage>
          )}
          {isFull && !currentParticipant && (
            <StatusMessage tone="warning">Oppgaven er full.</StatusMessage>
          )}

          <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-2">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted">{label}</dt>
                  <dd className="text-sm text-fg">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Beskrivelse</h3>
            <p className="whitespace-pre-line leading-relaxed text-muted">
              {task.description || 'Ingen beskrivelse.'}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Deltakere ({participantCount}/{task.maxParticipants})
            </h3>
            {!canViewAllParticipants(userRole) ? (
              <p className="text-sm text-muted">
                {participantCount} av {task.maxParticipants} plasser er tatt.
              </p>
            ) : participantCount === 0 ? (
              <p className="text-sm text-subtle">Ingen deltakere ennå.</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {task.participants.map((participant) => (
                  <li
                    key={participant.assignmentId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="truncate text-sm font-medium">
                      {participantNames[participant.userId] || 'Ukjent bruker'}
                      {participant.userId === currentUserId && (
                        <span className="ml-1 font-normal text-subtle">(deg)</span>
                      )}
                    </span>
                    <TaskAssignmentBadge status={participant.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming === 'complete'}
        title="Send inn til godkjenning?"
        confirmLabel="Send inn"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          onCompleteTask?.(task.id);
        }}
      >
        {task.hourEstimate} timer blir registrert som regi når regisjefen godkjenner.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === 'delete'}
        title="Slette oppgaven?"
        confirmLabel="Slett oppgave"
        tone="danger"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          onDeleteTask?.(task.id);
        }}
      >
        «{task.title}» og alle påmeldinger slettes. Dette kan ikke angres.
      </ConfirmDialog>
    </>
  );
};

export default TaskModal;
