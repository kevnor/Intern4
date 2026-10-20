import { useCallback, useEffect, useState } from 'react';
import { getPendingRegiApprovals, getRegiLogsByUser } from '../../server/dao/regiDAO';
import { getTasks } from '../../server/dao/tasksDAO';
import { canApproveWork } from '../../features/regi/permissions';
import { getSemesterStart } from '../../shared/utils/semester';
import { RegiLogWithId } from '../../shared/types/regi';
import { Task } from '../../shared/types/regi/tasks';
import type { AuthUser } from '../../features/auth/hooks/useAuth';

type HomeData = {
  logs: RegiLogWithId[];
  tasks: Task[];
  pendingApprovals: number | null;
};

const EMPTY: HomeData = { logs: [], tasks: [], pendingApprovals: null };

export const useHomeData = (user: AuthUser) => {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;
  const isManager = canApproveWork(user?.role);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      setError(null);
      const [logs, tasks, pending] = await Promise.all([
        getRegiLogsByUser(userId),
        getTasks({ since: getSemesterStart(), userId }),
        isManager ? getPendingRegiApprovals() : Promise.resolve(null),
      ]);

      setData({ logs, tasks, pendingApprovals: pending?.length ?? null });
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste forsiden. Prøv å oppdatere siden.');
    } finally {
      setLoading(false);
    }
  }, [userId, isManager]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...data, loading, error, reload: load };
};
