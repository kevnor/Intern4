import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { useSemesterHours } from '../../regi/hooks/useSemesterHours';
import AdminTab from '../components/AdminTab';
import MyShiftsTab from '../components/MyShiftsTab';
import PlanTab from '../components/PlanTab';
import ShiftEditModal from '../components/ShiftEditModal';
import UnavailabilityCard from '../components/UnavailabilityCard';
import { useShifts } from '../hooks/useShifts';
import { useUnavailability } from '../hooks/useUnavailability';
import { useVaktAdmin } from '../hooks/useVaktAdmin';
import { SHIFT_PATHS } from '../paths';
import { canManageVakt } from '../permissions';
import type { Shift } from '../types';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner, StatusMessage } from '../../../shared/components';
import { getSemester } from '../../../shared/utils/semester';

const TABS = [
  { key: 'mine', label: 'Mine vakter', path: SHIFT_PATHS.MINE },
  { key: 'plan', label: 'Vaktplan', path: SHIFT_PATHS.PLAN },
  { key: 'admin', label: 'Administrer', path: SHIFT_PATHS.ADMIN, managerOnly: true },
] as const;

const semester = getSemester();

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
  const [editing, setEditing] = useState<Shift | null>(null);

  if (authLoading) return <Spinner label="Laster..." />;
  if (!user) return null;

  const tabs = TABS.filter((tab) => isManager || !('managerOnly' in tab));
  const path = pathname.replace(/\/$/, '');
  const activeTab = tabs.find((tab) => tab.path === path);
  if (!activeTab) return <Navigate to={SHIFT_PATHS.MINE} replace />;

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
        }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(tabs.find((tab) => tab.key === key)!.path)}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div role="tabpanel" aria-label={activeTab.label} className="space-y-6">
        {activeTab.key === 'mine' && (
          <>
            <MyShiftsTab
              shifts={shifts}
              loading={loading}
              userId={user.id}
              role={user.role}
              totalHours={totalHours}
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
            onSelectShift={setEditing}
            onCreateSlots={createSlots}
          />
        )}
        {activeTab.key === 'admin' && <AdminTab admin={admin} />}
      </div>

      {editing && (
        <ShiftEditModal
          key={editing.id}
          shift={editing}
          users={admin.users}
          busy={admin.busy}
          onSave={admin.assignShift}
          onClose={() => setEditing(null)}
        />
      )}
    </PageLayout>
  );
};

export default VaktHubPage;
