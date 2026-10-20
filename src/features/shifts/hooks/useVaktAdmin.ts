import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignShiftUsers,
  clearDraftAssignments,
  publishShifts,
  setShiftUser,
} from '../../../server/dao/shiftsDAO';
import { getUnavailability } from '../../../server/dao/unavailabilityDAO';
import { getActiveUsersWithRole } from '../../../server/dao/userDAO';
import type { BasicUserWithRole } from '../../../shared/types/user';
import { assignShifts, type AssignmentResult } from '../assign';
import type { Shift, Unavailability } from '../types';
import { getSchedulableResidents, getTargetShifts } from '../vaktTargets';

export type ResidentRow = {
  id: string;
  name: string;
  role?: string;
  onLeave: boolean;
  targetShifts: number;
  assignedShifts: number;
};

type Options = {
  enabled: boolean;
  shifts: Shift[];
  from: Date;
  to: Date;
  totalHours: number;
  reload: () => Promise<void>;
};

// Everything the Vaktsjef needs to build the schedule: who can be scheduled, who is unavailable
// and the actions that change shifts. Only loads for managers.
export const useVaktAdmin = ({ enabled, shifts, from, to, totalHours, reload }: Options) => {
  const [users, setUsers] = useState<BasicUserWithRole[]>([]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<AssignmentResult | null>(null);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([getActiveUsersWithRole(), getUnavailability(new Date(fromTime), new Date(toTime))])
      .then(([loadedUsers, periods]) => {
        if (cancelled) return;
        setUsers(loadedUsers);
        setUnavailability(periods);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError('Kunne ikke laste beboerne.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fromTime, toTime]);

  const run = useCallback(
    async (action: () => Promise<void>, failure: string): Promise<boolean> => {
      try {
        setBusy(true);
        setError(null);
        await action();
        await reload();
        return true;
      } catch (actionError) {
        console.error(actionError);
        setError(failure);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const rows = useMemo<ResidentRow[]>(() => {
    const counts = new Map<string, number>();
    for (const shift of shifts) {
      if (shift.userId) counts.set(shift.userId, (counts.get(shift.userId) ?? 0) + 1);
    }
    return users
      .map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        onLeave: user.onLeave,
        targetShifts: user.onLeave ? 0 : getTargetShifts(user.role, totalHours),
        assignedShifts: counts.get(user.id) ?? 0,
      }))
      .filter((row) => row.targetShifts > 0 || row.assignedShifts > 0);
  }, [users, shifts, totalHours]);

  const stats = useMemo(() => {
    const drafts = shifts.filter((shift) => shift.status === 'draft').length;
    return {
      total: shifts.length,
      filled: shifts.filter((shift) => shift.userId).length,
      drafts,
      published: shifts.length - drafts,
    };
  }, [shifts]);

  // Fills the empty draft shifts. Filled shifts, drafts or published, are kept and count towards
  // each resident's target.
  const autoAssign = useCallback(
    () =>
      run(async () => {
        const candidates = shifts.filter((shift) => shift.userId || shift.status === 'draft');
        const result = assignShifts(
          candidates,
          getSchedulableResidents(users, totalHours),
          unavailability
        );
        setLastRun(result);
        const byId = new Map(shifts.map((shift) => [shift.id, shift]));
        await assignShiftUsers(
          result.assignments.map(({ shiftId, userId }) => ({
            ...byId.get(shiftId)!,
            id: shiftId,
            userId,
          }))
        );
      }, 'Kunne ikke fordele vaktene.'),
    [run, shifts, users, totalHours, unavailability]
  );

  const clearDrafts = useCallback(
    () =>
      run(async () => {
        setLastRun(null);
        await clearDraftAssignments(new Date(fromTime), new Date(toTime));
      }, 'Kunne ikke nullstille fordelingen.'),
    [run, fromTime, toTime]
  );

  const publish = useCallback(
    () =>
      run(
        () => publishShifts(new Date(fromTime), new Date(toTime)),
        'Kunne ikke publisere vaktplanen.'
      ),
    [run, fromTime, toTime]
  );

  const assignShift = useCallback(
    (shiftId: string, userId: string | null) =>
      run(() => setShiftUser(shiftId, userId), 'Kunne ikke endre vakten.'),
    [run]
  );

  return {
    users,
    rows,
    stats,
    unavailability,
    loading,
    busy,
    error,
    lastRun,
    autoAssign,
    clearDrafts,
    publish,
    assignShift,
  };
};
