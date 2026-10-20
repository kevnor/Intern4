import { useState } from 'react';
import { Task } from '../../../shared/types/regi/tasks';
import type { useTaskManagement } from './useTaskManagement';

// Join and submit from task cards: tracks the busy card and the submit confirmation.
export const useTaskActions = (management: ReturnType<typeof useTaskManagement>) => {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [submitCandidate, setSubmitCandidate] = useState<Task | null>(null);

  const run = async (taskId: string, action: (id: string) => Promise<void>) => {
    setBusyTaskId(taskId);
    try {
      await action(taskId);
    } finally {
      setBusyTaskId(null);
    }
  };

  return {
    busyTaskId,
    submitCandidate,
    join: (taskId: string) => void run(taskId, management.handleJoinTask),
    requestSubmit: (task: Task) => setSubmitCandidate(task),
    cancelSubmit: () => setSubmitCandidate(null),
    confirmSubmit: async () => {
      if (!submitCandidate) return;
      const taskId = submitCandidate.id;
      setSubmitCandidate(null);
      await run(taskId, management.handleCompleteTask);
    },
  };
};
