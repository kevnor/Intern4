import { useCallback, useEffect, useMemo, useState } from 'react';
import { PendingRegiApproval } from '../../../../shared/types/regi';
import {
  ALREADY_PROCESSED_MESSAGE,
  approveRegiLog,
  getPendingRegiApprovals,
  rejectRegiLog,
} from '../../../../server/dao/regiDAO';
import { canApproveWork } from '../../permissions';
import { AuthUser } from '../../../auth/hooks/useAuth';

export type ApprovalNotice = { tone: 'success' | 'warning' | 'error'; text: string };

export const useWorkApprovals = (user: AuthUser, authLoading: boolean) => {
  const [approvals, setApprovals] = useState<PendingRegiApproval[]>([]);
  const [selected, setSelected] = useState<PendingRegiApproval | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Several rows can be in flight at once; track each so their buttons stay disabled.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ApprovalNotice | null>(null);
  const [query, setQuery] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPendingRegiApprovals();
      setApprovals(data);
    } catch (e) {
      console.error(e);
      setError('Kunne ikke laste godkjenninger.');
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
    if (!q) return approvals;

    return approvals.filter((approval) => {
      return (
        approval.userName.toLowerCase().includes(q) ||
        approval.title.toLowerCase().includes(q) ||
        (approval.description ?? '').toLowerCase().includes(q) ||
        (approval.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [approvals, query]);

  const setBusy = (assignmentId: string, busy: boolean) =>
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(assignmentId);
      else next.delete(assignmentId);
      return next;
    });

  const removeApproval = (assignmentId: string) => {
    setApprovals((prev) => prev.filter((approval) => approval.id !== assignmentId));
    setSelected((current) => (current?.id === assignmentId ? null : current));
  };

  const decide = async (
    assignmentId: string,
    action: (deciderId: string) => Promise<void>,
    successText: string,
    failureText: string
  ): Promise<boolean> => {
    if (!user || busyIds.has(assignmentId)) return false;

    setBusy(assignmentId, true);
    setNotice(null);
    try {
      await action(user.id);
      removeApproval(assignmentId);
      setNotice({ tone: 'success', text: successText });
      return true;
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === ALREADY_PROCESSED_MESSAGE) {
        removeApproval(assignmentId);
        setNotice({ tone: 'warning', text: ALREADY_PROCESSED_MESSAGE });
      } else {
        setNotice({ tone: 'error', text: failureText });
      }
      return false;
    } finally {
      setBusy(assignmentId, false);
    }
  };

  const titleOf = (assignmentId: string) =>
    approvals.find((approval) => approval.id === assignmentId)?.title ?? 'Registreringen';

  const approve = (assignmentId: string, comment?: string) =>
    decide(
      assignmentId,
      (deciderId) => approveRegiLog(assignmentId, deciderId, comment),
      `«${titleOf(assignmentId)}» er godkjent.`,
      'Kunne ikke godkjenne. Prøv igjen.'
    );

  const reject = (assignmentId: string, comment?: string) =>
    decide(
      assignmentId,
      (deciderId) => rejectRegiLog(assignmentId, deciderId, comment),
      `«${titleOf(assignmentId)}» er avslått.`,
      'Kunne ikke avslå. Prøv igjen.'
    );

  return {
    approvals,
    filtered,
    selected,
    setSelected,
    loading,
    busyIds,
    error,
    notice,
    clearNotice: () => setNotice(null),
    query,
    setQuery,
    load,
    approve,
    reject,
  };
};

export type WorkApprovalsState = ReturnType<typeof useWorkApprovals>;
