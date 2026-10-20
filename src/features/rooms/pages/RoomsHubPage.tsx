import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import AllRoomsTab from '../components/AllRoomsTab';
import MyRoomTab from '../components/MyRoomTab';
import { useRooms } from '../hooks/useRooms';
import { ROOM_PATHS } from '../paths';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner, StatusMessage } from '../../../shared/components';

const TABS = [
  { key: 'mine', label: 'Mitt rom', path: ROOM_PATHS.MINE },
  { key: 'all', label: 'Alle rom', path: ROOM_PATHS.ALL },
] as const;

const RoomsHubPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { rooms, loading, error, reload } = useRooms();

  if (authLoading) return <Spinner label="Laster..." />;
  if (!user) return null;

  const path = pathname.replace(/\/$/, '');
  const activeTab = TABS.find((tab) => tab.path === path);
  if (!activeTab) return <Navigate to={ROOM_PATHS.MINE} replace />;

  return (
    <PageLayout title="Rom" description="Ditt rom, hvem som bor hvor, og romhistorikk.">
      <SectionTabs
        label="Rom"
        tabs={TABS.map(({ key, label }) => ({ key, label }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(TABS.find((tab) => tab.key === key)!.path)}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div role="tabpanel" aria-label={activeTab.label}>
        {activeTab.key === 'mine' && <MyRoomTab rooms={rooms} loading={loading} userId={user.id} />}
        {activeTab.key === 'all' && (
          <AllRoomsTab rooms={rooms} loading={loading} onRefresh={() => void reload()} />
        )}
      </div>
    </PageLayout>
  );
};

export default RoomsHubPage;
