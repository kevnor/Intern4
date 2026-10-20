import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { useSemesterHours } from '../../regi/hooks/useSemesterHours';
import MyShiftsTab from '../components/MyShiftsTab';
import PlanTab from '../components/PlanTab';
import { useShifts } from '../hooks/useShifts';
import { SHIFT_PATHS } from '../paths';
import { canManageVakt } from '../permissions';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner, StatusMessage } from '../../../shared/components';
import { getSemester } from '../../../shared/utils/semester';

const TABS = [
  { key: 'mine', label: 'Mine vakter', path: SHIFT_PATHS.MINE },
  { key: 'plan', label: 'Vaktplan', path: SHIFT_PATHS.PLAN },
] as const;

const semester = getSemester();

const VaktHubPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { totalHours } = useSemesterHours();
  const { shifts, loading, error, createSlots } = useShifts(semester.start, semester.end);

  if (authLoading) return <Spinner label="Laster..." />;
  if (!user) return null;

  const path = pathname.replace(/\/$/, '');
  if (!TABS.some((tab) => tab.path === path)) return <Navigate to={SHIFT_PATHS.MINE} replace />;
  const activeTab = TABS.find((tab) => tab.path === path)!;

  return (
    <PageLayout
      title="Vakt"
      description={`${semester.name} · Din vaktplan og hele resepsjonens vakter.`}
    >
      <SectionTabs
        label="Vakt"
        tabs={TABS.map(({ key, label }) => ({ key, label }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(TABS.find((tab) => tab.key === key)!.path)}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div role="tabpanel" aria-label={activeTab.label}>
        {activeTab.key === 'mine' && (
          <MyShiftsTab
            shifts={shifts}
            loading={loading}
            userId={user.id}
            role={user.role}
            totalHours={totalHours}
          />
        )}
        {activeTab.key === 'plan' && (
          <PlanTab
            shifts={shifts}
            loading={loading}
            userId={user.id}
            canManage={canManageVakt(user.role)}
            onCreateSlots={createSlots}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default VaktHubPage;
