import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SEMESTER_HOURS,
  getRequiredHoursForRole,
} from '../../../../app/constants/regiRequirements';
import { canApproveWork } from '../../permissions';
import { getApprovedRegiHoursByUserSince } from '../../../../server/dao/regiDAO';
import { getActiveUsersWithRole } from '../../../../server/dao/userDAO';
import { AuthUser } from '../../../auth/hooks/useAuth';
import { getRequiredHours } from '../../../../server/dao/semesterSettingsDAO';
import { getCompletedShiftCounts } from '../../../../server/dao/vaktHoursDAO';
import { SHIFT_HOURS } from '../../../shifts/slots';
import { getSemester, getSemesterStart } from '../../../../shared/utils/semester';

export type RegistatusRow = {
  id: string;
  name: string;
  email: string;
  role?: string;
  // Regi and vakt added together; the breakdown below is shown when the resident has vakt.
  requiredHours: number;
  approvedHours: number;
  remainingHours: number;
  regiHours: number;
  vaktHours: number;
  requiresVakt: boolean;
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

      const [activeUsers, hoursMap, configuredHours, vaktCounts] = await Promise.all([
        getActiveUsersWithRole(),
        getApprovedRegiHoursByUserSince(getSemesterStart()),
        getRequiredHours(getSemester().key).catch(() => undefined),
        // Without shifts everyone simply shows no vakt done.
        getCompletedShiftCounts(getSemesterStart()).catch(() => ({}) as Record<string, number>),
      ]);
      const totalHours = configuredHours ?? DEFAULT_SEMESTER_HOURS;

      const nextRows = activeUsers.map((activeUser) => {
        const required = getRequiredHoursForRole(activeUser.role, totalHours);
        const regiHours = hoursMap[activeUser.id] ?? 0;
        const vaktHours = (vaktCounts[activeUser.id] ?? 0) * SHIFT_HOURS;
        // Extra regi doesn't make up for missing vakt, or the other way around.
        const remainingHours =
          Math.max(required.regi - regiHours, 0) + Math.max(required.vakt - vaktHours, 0);

        return {
          id: activeUser.id,
          name: activeUser.name,
          email: activeUser.email,
          role: activeUser.role ?? 'Halv/Halv',
          requiredHours: required.regi + required.vakt,
          approvedHours: regiHours + vaktHours,
          remainingHours,
          regiHours,
          vaktHours,
          requiresVakt: required.vakt > 0 || vaktHours > 0,
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
