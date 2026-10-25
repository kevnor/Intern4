import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner } from '../../../shared/components';
import RolesTab from '../components/RolesTab';
import SemesterTab from '../components/SemesterTab';
import { ADMIN_PATHS } from '../paths';
import { canAccessAdmin } from '../permissions';

const TABS = [
  { key: 'roles', label: 'Roller', path: ADMIN_PATHS.ROLES },
  { key: 'semester', label: 'Semester', path: ADMIN_PATHS.SEMESTER },
] as const;

// The route already keeps everyone but Admin and Data out; the check here is for the page on its own.
const AdminHubPage = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (loading) return <Spinner label="Laster..." />;
  if (!user || !canAccessAdmin(user.role)) return null;

  const path = pathname.replace(/\/$/, '');
  const activeTab = TABS.find((tab) => tab.path === path);
  if (!activeTab) return <Navigate to={TABS[0].path} replace />;

  return (
    <PageLayout
      title="Admin"
      description="Roller og innstillinger for dem som administrerer Intern."
    >
      <SectionTabs
        label="Admin"
        tabs={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(TABS.find((tab) => tab.key === key)!.path)}
      />

      <div role="tabpanel" aria-label={activeTab.label}>
        {activeTab.key === 'roles' && <RolesTab />}
        {activeTab.key === 'semester' && <SemesterTab />}
      </div>
    </PageLayout>
  );
};

export default AdminHubPage;
