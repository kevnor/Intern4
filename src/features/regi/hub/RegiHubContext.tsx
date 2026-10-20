import React, { createContext, useContext, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthContext';
import { useWorkLogList } from '../my-regi/hooks/useWorkLogList';
import { useWorkApprovals } from '../approvals/hooks/useWorkApprovals';
import { useTaskManagement } from '../../tasks/hooks/useTaskManagement';
import { useTaskActions } from '../../tasks/hooks/useTaskActions';
import { canApproveWork } from '../permissions';
import type { AuthUser } from '../../auth/hooks/useAuth';

type RegiHubState = {
  user: NonNullable<AuthUser>;
  isManager: boolean;
  logs: ReturnType<typeof useWorkLogList>;
  tasks: ReturnType<typeof useTaskManagement>;
  taskActions: ReturnType<typeof useTaskActions>;
  approvals: ReturnType<typeof useWorkApprovals>;
  categoryColors: Record<string, string>;
  registerOpen: boolean;
  setRegisterOpen: (open: boolean) => void;
  openRegister: () => void;
  grant: GrantState;
  openGrant: (userId?: string) => void;
  closeGrant: () => void;
};

type GrantState = { open: boolean; userId?: string };

const RegiHubContext = createContext<RegiHubState | undefined>(undefined);

type RegiHubProviderProps = {
  user: NonNullable<AuthUser>;
  children: React.ReactNode;
};

// Loaded once for the whole hub so switching tabs doesn't refetch.
export const RegiHubProvider = ({ user, children }: RegiHubProviderProps) => {
  const { loading: authLoading } = useAuth();
  const logs = useWorkLogList(user.id);
  // Joining, leaving or submitting a task changes the user's hours.
  const tasks = useTaskManagement({ onAssignmentsChanged: () => void logs.reload() });
  const taskActions = useTaskActions(tasks);
  // Only loads for regi managers.
  const approvals = useWorkApprovals(user, authLoading);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [grant, setGrant] = useState<GrantState>({ open: false });

  const categoryColors = useMemo(
    () => Object.fromEntries(tasks.categories.map((category) => [category.name, category.color])),
    [tasks.categories]
  );

  const value: RegiHubState = {
    user,
    isManager: canApproveWork(user.role),
    logs,
    tasks,
    taskActions,
    approvals,
    categoryColors,
    registerOpen,
    setRegisterOpen,
    openRegister: () => setRegisterOpen(true),
    grant,
    openGrant: (userId) => setGrant({ open: true, userId }),
    closeGrant: () => setGrant({ open: false }),
  };

  return <RegiHubContext.Provider value={value}>{children}</RegiHubContext.Provider>;
};

export const useRegiHub = (): RegiHubState => {
  const hub = useContext(RegiHubContext);
  if (!hub) throw new Error('useRegiHub must be used within a RegiHubProvider');
  return hub;
};
