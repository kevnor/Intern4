import { getRequiredRegiHoursForRole } from '../../app/constants/regiRequirements';
import { RegiLogWithId } from '../../shared/types/regi';
import {
  Task,
  canUserJoinTask,
  canUserSubmitTaskCompletion,
  getCurrentUserTaskParticipant,
} from '../../shared/types/regi/tasks';
import { getSemesterStart } from '../../shared/utils/semester';

export type RegiSummary = {
  approved: number;
  pending: number;
  required: number;
  remaining: number;
};

// Only work performed this semester counts towards this semester's requirement.
export const summarizeSemesterRegi = (
  logs: RegiLogWithId[],
  role: string | undefined,
  now: Date = new Date(),
  totalHours?: number
): RegiSummary => {
  const start = getSemesterStart(now);
  const thisSemester = logs.filter((log) => log.date >= start);
  const sum = (status: RegiLogWithId['status']) =>
    thisSemester
      .filter((log) => log.status === status)
      .reduce((total, log) => total + log.hours, 0);

  const approved = sum('approved');
  const required = getRequiredRegiHoursForRole(role, totalHours);

  return {
    approved,
    pending: sum('pending'),
    required,
    remaining: Math.max(required - approved, 0),
  };
};

const MY_TASK_ORDER = { rejected: 0, joined: 1, submitted: 2, approved: 3 } as const;

// Tasks the user still has something to do or wait for; approved ones are done.
export const getMyActiveTasks = (tasks: Task[], userId: string): Task[] =>
  tasks
    .filter((task) => {
      const participant = getCurrentUserTaskParticipant(task, userId);
      return participant && participant.status !== 'approved';
    })
    .sort(
      (a, b) =>
        MY_TASK_ORDER[getCurrentUserTaskParticipant(a, userId)!.status] -
        MY_TASK_ORDER[getCurrentUserTaskParticipant(b, userId)!.status]
    );

const deadlineTime = (task: Task) =>
  task.deadline ? new Date(task.deadline).getTime() : Number.POSITIVE_INFINITY;

export const getSuggestedTasks = (tasks: Task[], userId: string, limit = 3): Task[] =>
  tasks
    .filter((task) => canUserJoinTask(task, userId))
    .sort((a, b) => deadlineTime(a) - deadlineTime(b))
    .slice(0, limit);

export type RegiTodo = {
  // Joined (or rejected) tasks the user can send in for approval.
  tasksToSubmit: Task[];
  // This semester's rejected manual entries, so the user sees the manager's comment.
  rejectedEntries: RegiLogWithId[];
  count: number;
};

export const getRegiTodo = (
  logs: RegiLogWithId[],
  tasks: Task[],
  userId: string,
  now: Date = new Date()
): RegiTodo => {
  const start = getSemesterStart(now);
  const tasksToSubmit = getMyActiveTasks(tasks, userId).filter((task) =>
    canUserSubmitTaskCompletion(task, userId)
  );
  const rejectedEntries = logs.filter(
    (log) => log.status === 'rejected' && log.sourceType === 'misc' && log.date >= start
  );

  return {
    tasksToSubmit,
    rejectedEntries,
    count: tasksToSubmit.length + rejectedEntries.length,
  };
};
