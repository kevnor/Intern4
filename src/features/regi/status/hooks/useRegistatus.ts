import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SEMESTER_HOURS,
  getRequiredRegiHoursForRole,
} from '../../../../app/constants/regiRequirements';
import { canApproveWork } from '../../permissions';
import { getApprovedRegiHoursByUserSince } from '../../../../server/dao/regiDAO';
import { getActiveUsersWithRole } from '../../../../server/dao/userDAO';
import { AuthUser } from '../../../auth/hooks/useAuth';
import { getRequiredHours } from '../../../../server/dao/semesterSettingsDAO';
import { getSemester, getSemesterStart } from '../../../../shared/utils/semester';

export type RegistatusRow = {
  id: string;
  name: string;
  email: string;
  role?: string;
  requiredHours: number;
  approvedHours: number;
  remainingHours: number;
  onLeave: boolean;
};

export const useRegistatus = (user: AuthUser, authLoading: boolean) => {
  const [rows, setRows] = useState<RegistatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const [activeUsers, hoursMap, configuredHours] = await Promise.all([
        getActiveUsersWithRole(),
        getApprovedRegiHoursByUserSince(getSemesterStart()),
        getRequiredHours(getSemester().key).catch(() => undefined),
      ]);
      const totalHours = configuredHours ?? DEFAULT_SEMESTER_HOURS;

      const nextRows = activeUsers.map((activeUser) => {
        const requiredHours = getRequiredRegiHoursForRole(activeUser.role, totalHours);
        const approvedHours = hoursMap[activeUser.id] ?? 0;
        const remainingHours = Math.max(requiredHours - approvedHours, 0);

        return {
          id: activeUser.id,
          name: activeUser.name,
          email: activeUser.email,
          role: activeUser.role ?? 'Halv/Halv',
          requiredHours,
          approvedHours,
          remainingHours,
          onLeave: activeUser.onLeave,
        };
      });

      nextRows.sort(
        (a, b) =>
          b.remainingHours - a.remainingHours ||
          a.name.localeCompare(b.name, 'no', { sensitivity: 'base' })
      );

      setRows(nextRows);
    } catch (e) {
      console.error(e);
      setError('Kunne ikke laste registatus.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Depend on id and role, not the user object, which is recreated on every auth event.
  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    if (!canApproveWork(userRole)) return;
    void load();
  }, [authLoading, load, userId, userRole]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.role ?? '').toLowerCase().includes(q)
    );
  }, [query, rows]);

  return {
    semesterLabel: getSemesterStart().toLocaleDateString('no-NO'),
    filtered,
    loading,
    error,
    query,
    setQuery,
    load,
  };
};
