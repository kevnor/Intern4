import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import AllRoomsTab from '../components/AllRoomsTab';
import MyRoomTab from '../components/MyRoomTab';
import ReportsTab from '../components/ReportsTab';
import RomslippTab from '../components/RomslippTab';
import RoomAdminTab from '../components/RoomAdminTab';
import { useRoomAdmin } from '../hooks/useRoomAdmin';
import { useRomslipp } from '../hooks/useRomslipp';
import { useRoomReports } from '../hooks/useRoomReports';
import { useRooms } from '../hooks/useRooms';
import { ROOM_PATHS } from '../paths';
import { canManageRooms } from '../permissions';
import { canCreateTaskFromReport, canHandleReports, isActiveReport } from '../reports';
import { isMyTurn } from '../romslipp';
import { PageLayout } from '../../../shared/layouts';
import { SectionTabs, Spinner, StatusMessage } from '../../../shared/components';

const TABS = [
  { key: 'mine', label: 'Mitt rom', path: ROOM_PATHS.MINE },
  { key: 'all', label: 'Alle rom', path: ROOM_PATHS.ALL },
  { key: 'romslipp', label: 'Romslipp', path: ROOM_PATHS.ROMSLIPP },
  { key: 'reports', label: 'Meldinger', path: ROOM_PATHS.REPORTS, access: 'reports' },
  { key: 'admin', label: 'Administrer', path: ROOM_PATHS.ADMIN, access: 'rooms' },
] as const;

const RoomsHubPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { rooms, loading, error, reload } = useRooms();
  const isManager = canManageRooms(user?.role);
  const handlesReports = canHandleReports(user?.role);
  const reports = useRoomReports({ enabled: handlesReports });
  const romslipp = useRomslipp();
  const admin = useRoomAdmin({ enabled: isManager, rooms, reloadRooms: reload });

  const myTurn =
    romslipp.state?.round.status === 'open' &&
    isMyTurn(romslipp.state.participants, user?.id ?? '');

  if (authLoading) return <Spinner label="Laster..." />;
  if (!user) return null;

  const tabs = TABS.filter((tab) => {
    if (!('access' in tab)) return true;
    return tab.access === 'rooms' ? isManager : handlesReports;
  });
  const path = pathname.replace(/\/$/, '');
  const activeTab = tabs.find((tab) => tab.path === path);
  if (!activeTab) return <Navigate to={ROOM_PATHS.MINE} replace />;

  return (
    <PageLayout title="Rom" description="Ditt rom, hvem som bor hvor, og romhistorikk.">
      <SectionTabs
        label="Rom"
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          separated: 'access' in tab && tab.key === 'reports',
          count:
            tab.key === 'reports'
              ? reports.reports.filter(isActiveReport).length || undefined
              : tab.key === 'romslipp' && myTurn
                ? 1
                : undefined,
        }))}
        activeKey={activeTab.key}
        onChange={(key) => navigate(tabs.find((tab) => tab.key === key)!.path)}
      />

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div role="tabpanel" aria-label={activeTab.label}>
        {activeTab.key === 'mine' && <MyRoomTab rooms={rooms} loading={loading} userId={user.id} />}
        {activeTab.key === 'all' && (
          <AllRoomsTab rooms={rooms} loading={loading} onRefresh={() => void reload()} />
        )}
        {activeTab.key === 'romslipp' && (
          <RomslippTab romslipp={romslipp} userId={user.id} canManage={isManager} />
        )}
        {activeTab.key === 'reports' && (
          <ReportsTab reports={reports} canCreateTask={canCreateTaskFromReport(user.role)} />
        )}
        {activeTab.key === 'admin' && <RoomAdminTab rooms={rooms} admin={admin} />}
      </div>
    </PageLayout>
  );
};

export default RoomsHubPage;
