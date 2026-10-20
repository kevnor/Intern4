import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { CategoryBadge, DataTable, EmptyState } from '../../../shared/components';
import { Task } from '../../../shared/types/regi/tasks';
import { formatDeadline } from '../../../shared/utils/date';
import { ParticipantMeter, TaskCard, TaskStatusAction } from './TaskCard';
import { TasksTableProps } from './types';

const TasksTable: React.FC<TasksTableProps> = ({
  tasks,
  categories = [],
  onRowClick,
  onJoinTask,
  onSubmitTask,
  busyTaskId,
  currentUserId,
  participantNames = {},
}) => {
  const categoryColors = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.name, category.color])),
    [categories]
  );

  const contactName = (task: Task) =>
    task.contactPersonId ? (participantNames[task.contactPersonId] ?? 'Ukjent bruker') : undefined;

  const actionProps = (task: Task) => ({
    task,
    currentUserId,
    onJoin: onJoinTask ? (joinTask: Task) => onJoinTask(joinTask.id) : undefined,
    onSubmit: onSubmitTask,
    busy: busyTaskId === task.id,
  });

  return (
    <DataTable
      rows={tasks}
      getRowKey={(task) => task.id}
      onRowClick={onRowClick}
      getRowLabel={(task) => `Åpne ${task.title}`}
      bareCards
      renderCard={(task) => (
        <TaskCard
          {...actionProps(task)}
          categoryColor={categoryColors[task.category]}
          contactName={contactName(task)}
          onOpen={onRowClick}
        />
      )}
      emptyMessage={
        <EmptyState title="Ingen oppgaver" icon={<Users className="h-6 w-6" />}>
          Ingen oppgaver matcher søket ditt.
        </EmptyState>
      }
      columns={[
        {
          key: 'title',
          header: 'Oppgave',
          render: (task) => (
            <div className="max-w-xs">
              <div className="font-medium">{task.title}</div>
              {task.description && (
                <div className="truncate text-sm text-subtle">{task.description}</div>
              )}
            </div>
          ),
        },
        {
          key: 'category',
          header: 'Kategori',
          render: (task) => (
            <CategoryBadge name={task.category} color={categoryColors[task.category]} />
          ),
        },
        { key: 'contact', header: 'Kontakt', render: (task) => contactName(task) ?? '–' },
        {
          key: 'deadline',
          header: 'Frist',
          className: 'whitespace-nowrap',
          render: (task) => formatDeadline(task.deadline),
        },
        {
          key: 'hours',
          header: 'Timer',
          className: 'whitespace-nowrap',
          render: (task) => (task.hourEstimate ? `${task.hourEstimate} t` : '–'),
        },
        {
          key: 'participants',
          header: 'Deltakere',
          render: (task) => <ParticipantMeter task={task} />,
        },
        {
          key: 'status',
          header: 'Status',
          render: (task) => <TaskStatusAction {...actionProps(task)} />,
        },
      ]}
    />
  );
};

export default TasksTable;
