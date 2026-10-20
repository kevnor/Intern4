import { useCallback, useEffect, useState } from 'react';
import {
  createRoomReport,
  getRoomReports,
  linkReportToTask,
  setReportStatus,
  withdrawRoomReport,
} from '../../../server/dao/roomReportsDAO';
import { addTask } from '../../../server/dao/tasksDAO';
import type { TaskCreationData } from '../../../shared/types/regi/tasks';
import type { RoomReport, RoomReportStatus } from '../types';

type Options = {
  // Reports for one room, or for everyone the signed-in user may see when left out.
  roomId?: string;
  enabled?: boolean;
};

// Reports and the actions on them. Every action reloads the list, and reports the message of the
// error ("Meldingen kan ikke trekkes tilbake") when the database refuses it.
export const useRoomReports = ({ roomId, enabled = true }: Options = {}) => {
  const [reports, setReports] = useState<RoomReport[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setReports(await getRoomReports(roomId));
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste meldingene.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const run = useCallback(
    async (action: () => Promise<void>, failure: string): Promise<boolean> => {
      try {
        setBusy(true);
        setError(null);
        await action();
        await load();
        return true;
      } catch (actionError) {
        console.error(actionError);
        setError(
          actionError instanceof Error && actionError.message ? actionError.message : failure
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const report = useCallback(
    (data: { roomId: string; reportedBy: string; title: string; description?: string }) =>
      run(() => createRoomReport(data), 'Kunne ikke sende meldingen.'),
    [run]
  );

  const changeStatus = useCallback(
    (reportId: string, status: RoomReportStatus) =>
      run(() => setReportStatus(reportId, status), 'Kunne ikke endre meldingen.'),
    [run]
  );

  const withdraw = useCallback(
    (reportId: string) => run(() => withdrawRoomReport(reportId), 'Kunne ikke trekke meldingen.'),
    [run]
  );

  // Creates the regi task and links the report to it. If linking fails the task still exists,
  // so the error says so instead of leaving the manager to create a duplicate.
  const createTask = useCallback(
    (reportId: string, task: TaskCreationData) =>
      run(async () => {
        const taskId = await addTask(task);
        try {
          await linkReportToTask(reportId, taskId);
        } catch (linkError) {
          console.error(linkError);
          throw new Error(
            'Oppgaven ble opprettet, men meldingen ble ikke koblet til den. Se Regi → Oppgaver.'
          );
        }
      }, 'Kunne ikke opprette oppgaven.'),
    [run]
  );

  return {
    reports,
    loading,
    busy,
    error,
    clearError: () => setError(null),
    report,
    changeStatus,
    withdraw,
    createTask,
  };
};

export type RoomReports = ReturnType<typeof useRoomReports>;
