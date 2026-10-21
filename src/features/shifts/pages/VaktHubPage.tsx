import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { useSemesterHours } from '../../regi/hooks/useSemesterHours';
import AdminTab from '../components/AdminTab';
import ClaimShiftModal from '../components/ClaimShiftModal';
import MyShiftsTab from '../components/MyShiftsTab';
import PlanTab from '../components/PlanTab';
import ShiftEditModal from '../components/ShiftEditModal';
import SwapRequestModal from '../components/SwapRequestModal';
import SwapsTab from '../components/SwapsTab';
import UnavailabilityCard from '../components/UnavailabilityCard';
import { useShifts } from '../hooks/useShifts';
import { useSwaps } from '../hooks/useSwaps';
import { useUnavailability } from '../hooks/useUnavailability';
import { useVaktAdmin } from '../hooks/useVaktAdmin';
import { SHIFT_PATHS } from '../paths';
import { canManageVakt } from '../permissions';
import { canRequestSwap, getOpenSwaps, hasRestConflict } from '../swaps';
import type { Shift } from '../types';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner, StatusMessage } from '../../../shared/components';
import { getSemester } from '../../../shared/utils/semester';

const TABS = [
  { key: 'mine', label: 'Mine vakter', path: SHIFT_PATHS.MINE },
  { key: 'plan', label: 'Vaktplan', path: SHIFT_PATHS.PLAN },
  { key: 'swaps', label: 'Bytter', path: SHIFT_PATHS.SWAPS },
  { key: 'admin', label: 'Administrer', path: SHIFT_PATHS.ADMIN, managerOnly: true },
] as const;

const semester = getSemester();

type Dialog = { kind: 'edit' | 'swap' | 'claim'; shift: Shift } | null;

const VaktHubPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { totalHours } = useSemesterHours();
  const { shifts, loading, error, reload, createSlots } = useShifts(semester.start, semester.end);
  const isManager = canManageVakt(user?.role);
  const admin = useVaktAdmin({
    enabled: isManager,
    shifts,
    from: semester.start,
    to: semester.end,
    totalHours,
    reload,
  });
  const unavailability = useUnavailability(user?.id ?? '', semester.start, semester.end);
  const swaps = useSwaps(user?.id ?? '', reload);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (authLoading) return <Spinner label="Laster..." />;
  if (!user) return null;

  const tabs = TABS.filter((tab) => isManager || !('managerOnly' in tab));
  const path = pathname.replace(/\/$/, '');
  const activeTab = tabs.find((tab) => tab.path === path);
  if (!activeTab) return <Navigate to={SHIFT_PATHS.MINE} replace />;

  const openSwaps = getOpenSwaps(shifts, user.id);
  const closeDialog = () => setDialog(null);
  // Starts from a clean slate: an old failure shouldn't greet the next dialog.
  const openDialog = (next: NonNullable<Dialog>) => {
    swaps.clearError();
    admin.clearError();
    setDialog(next);
  };

  // What picking a shift in the plan does: managers change it, residents swap or take it.
  const canSelect = (shift: Shift) =>
    isManager || canRequestSwap(shift, user.id) || openSwaps.some((open) => open.id === shift.id);
  const selectShift = (shift: Shift) => {
    if (isManager) openDialog({ kind: 'edit', shift });
    else if (shift.userId === user.id) openDialog({ kind: 'swap', shift });
    else openDialog({ kind: 'claim', shift });
  };

  return (
    <PageLayout
      title="Vakt"
      description={`${semester.name} · Din vaktplan og hele resepsjonens vakter.`}
    >
      <SectionTabs
        label="Vakt"
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          separated: 'managerOnly' in tab,
          count: tab.key === 'swaps' && openSwaps.length > 0 ? openSwaps.length : undefined,
        }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(tabs.find((tab) => tab.key === key)!.path)}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {swaps.error && !dialog && (
        <StatusMessage tone="error" onDismiss={swaps.clearError}>
          {swaps.error}
        </StatusMessage>
      )}

      <div role="tabpanel" aria-label={activeTab.label} className="space-y-6">
        {activeTab.key === 'mine' && (
          <>
            <MyShiftsTab
              shifts={shifts}
              loading={loading}
              userId={user.id}
              role={user.role}
              totalHours={totalHours}
              onSwap={(shift) => openDialog({ kind: 'swap', shift })}
            />
            <UnavailabilityCard unavailability={unavailability} />
          </>
        )}
        {activeTab.key === 'plan' && (
          <PlanTab
            shifts={shifts}
            loading={loading}
            userId={user.id}
            canManage={isManager}
            onSelectShift={selectShift}
            canSelect={canSelect}
            onCreateSlots={createSlots}
          />
        )}
        {activeTab.key === 'swaps' && (
          <SwapsTab
            shifts={shifts}
            log={swaps.log}
            loading={loading}
            busy={swaps.busy}
            userId={user.id}
            onClaim={(shift) => openDialog({ kind: 'claim', shift })}
            onManageMine={(shift) => openDialog({ kind: 'swap', shift })}
            onMarkPaid={(logId, paid) => void swaps.markPaid(logId, paid)}
          />
        )}
        {activeTab.key === 'admin' && <AdminTab admin={admin} />}
      </div>

      {dialog?.kind === 'edit' && (
        <ShiftEditModal
          key={dialog.shift.id}
          shift={dialog.shift}
          users={admin.users}
          busy={admin.busy}
          error={admin.error}
          onSave={admin.assignShift}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'swap' && (
        <SwapRequestModal
          key={dialog.shift.id}
          shift={dialog.shift}
          busy={swaps.busy}
          error={swaps.error}
          onRequest={swaps.request}
          onCancelSwap={swaps.cancel}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'claim' && (
        <ClaimShiftModal
          key={dialog.shift.id}
          shift={dialog.shift}
          busy={swaps.busy}
          error={swaps.error}
          restConflict={hasRestConflict(shifts, user.id, dialog.shift)}
          onClaim={swaps.claim}
          onClose={closeDialog}
        />
      )}
    </PageLayout>
  );
};

export default VaktHubPage;
