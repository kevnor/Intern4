import { useCallback, useEffect, useState } from 'react';
import { RegiLogWithId } from '../../../../shared/types/regi';
import { deletePendingRegiLog, getRegiLogsByUser } from '../../../../server/dao/regiDAO';

export const useWorkLogList = (userId: string) => {
  const [logs, setLogs] = useState<RegiLogWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setLogs(await getRegiLogsByUser(userId));
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste registreringene.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const deleteLog = async (log: RegiLogWithId): Promise<boolean> => {
    try {
      setDeletingId(log.id);
      setError(null);
      await deletePendingRegiLog(log.id, userId);
      setLogs((currentLogs) => currentLogs.filter((currentLog) => currentLog.id !== log.id));
      return true;
    } catch (deleteError) {
      console.error(deleteError);
      setError(
        deleteError instanceof Error ? deleteError.message : 'Kunne ikke slette registreringen.'
      );
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  return {
    logs,
    loading,
    deletingId,
    error,
    deleteLog,
    reload,
  };
};
