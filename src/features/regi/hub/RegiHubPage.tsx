import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Settings, UserPlus } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthContext';
import { RegiHubProvider, useRegiHub } from './RegiHubContext';
import OverviewTab from './OverviewTab';
import { GrantRegiSheet, RegisterHoursSheet } from './RegiSheets';
import { REGI_PATHS } from '../paths';
import { canApproveWork } from '../permissions';
import WorkLogList from '../my-regi/components/WorkLogList';
import WorkApprovalList from '../approvals/components/WorkApprovalList';
import Registatus from '../status/components/Registatus';
import RegiLogsPanel from '../logs/components/RegiLogsPanel';
import TasksPanel from '../../tasks/components/TasksPanel';
import TaskDialogs from '../../tasks/components/TaskDialogs';
import { PageLayout } from '../../../shared/layouts';
import { Button, SectionTabs, Spinner, StatusMessage } from '../../../shared/components';
import { getSemesterName } from '../../../shared/utils/semester';

type TabKey = 'oversikt' | 'oppgaver' | 'timer' | 'godkjenning' | 'status' | 'logg';

const TABS: { key: TabKey; label: string; path: string; managerOnly?: boolean }[] = [
  { key: 'oversikt', label: 'Oversikt', path: REGI_PATHS.REGI },
  { key: 'oppgaver', label: 'Oppgaver', path: REGI_PATHS.OPPGAVER },
  { key: 'timer', label: 'Mine timer', path: REGI_PATHS.TIMER },
  { key: 'godkjenning', label: 'Godkjenning', path: REGI_PATHS.GODKJENNING, managerOnly: true },
  { key: 'status', label: 'Status', path: REGI_PATHS.STATUS, managerOnly: true },
  { key: 'logg', label: 'Logg', path: REGI_PATHS.LOGG, managerOnly: true },
];

const RegiHub = ({ activeTab }: { activeTab: (typeof TABS)[number] }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  // Registatus loads its own data; a new key makes it reload after hours are granted.
  const [statusVersion, setStatusVersion] = useState(0);
  const {
    user,
    isManager,
    logs,
    tasks,
    taskActions,
    approvals,
    categoryColors,
    registerOpen,
    setRegisterOpen,
    openRegister,
    grant,
    openGrant,
    closeGrant,
  } = useRegiHub();

  // ?registrer=1 lets other pages (Hjem) link straight to the form.
  const showRegister = registerOpen || searchParams.get('registrer') === '1';
  const closeRegister = () => {
    setRegisterOpen(false);
    if (searchParams.has('registrer')) {
      searchParams.delete('registrer');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const tabs = TABS.filter((tab) => isManager || !tab.managerOnly).map((tab, index, list) => ({
    key: tab.key,
    label: tab.label,
    separated: tab.managerOnly && !list[index - 1]?.managerOnly,
    count:
      tab.key === 'godkjenning' && approvals.approvals.length > 0
        ? approvals.approvals.length
        : undefined,
  }));

  const onManagerTab = !!activeTab.managerOnly;

  return (
    <PageLayout
      title="Regi"
      description={`${getSemesterName()} · Oppgaver, timer og godkjenning på ett sted.`}
      actions={
        <>
          {tasks.refreshing && !tasks.loading && (
            <Spinner label="Oppdaterer..." className="text-subtle" />
          )}
          {activeTab.key === 'oppgaver' && tasks.canManageTaskCategories && (
            <Button
              variant="secondary"
              icon={<Settings aria-hidden="true" className="h-4 w-4" />}
              onClick={tasks.toggleCategoryManagement}
            >
              Kategorier
            </Button>
          )}
          {activeTab.key === 'oppgaver' && tasks.canCreateTasks && (
            <Button
              variant="secondary"
              icon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={tasks.handleOpenCreateTask}
            >
              Ny oppgave
            </Button>
          )}
          {onManagerTab ? (
            <Button
              icon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => openGrant()}
            >
              Gi regi
            </Button>
          ) : (
            // Phones use the floating button instead.
            <div className="hidden md:block">
              <Button icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={openRegister}>
                Registrer timer
              </Button>
            </div>
          )}
        </>
      }
    >
      <SectionTabs
        label="Regi"
        tabs={tabs}
        activeKey={activeTab.key}
        onChange={(key) => navigate(TABS.find((tab) => tab.key === key)!.path)}
      />

      {notice && (
        <StatusMessage tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </StatusMessage>
      )}
      {tasks.error && <StatusMessage tone="error">{tasks.error}</StatusMessage>}
      {tasks.message && (
        <StatusMessage
          tone={tasks.message.type === 'success' ? 'success' : 'error'}
          onDismiss={tasks.clearMessage}
        >
          {tasks.message.text}
        </StatusMessage>
      )}

      {/* Bottom padding on phones keeps the last item clear of the floating button. */}
      <div
        role="tabpanel"
        aria-label={activeTab.label}
        className={onManagerTab ? undefined : 'pb-20 md:pb-0'}
      >
        {activeTab.key === 'oversikt' && <OverviewTab />}
        {activeTab.key === 'oppgaver' && (
          <TasksPanel
            taskList={tasks.taskList}
            categories={tasks.categories}
            participantNames={tasks.participantNames}
            currentUserId={user.id}
            loading={tasks.loading}
            busyTaskId={taskActions.busyTaskId}
            onOpen={tasks.setSelectedTask}
            onJoin={taskActions.join}
            onSubmit={taskActions.requestSubmit}
            onShowOlder={tasks.includeOlder ? undefined : tasks.showOlderTasks}
            loadingOlder={tasks.refreshing}
          />
        )}
        {activeTab.key === 'timer' && (
          <WorkLogList
            logs={logs.logs}
            loading={logs.loading}
            error={logs.error}
            deletingId={logs.deletingId}
            onDelete={logs.deleteLog}
            categoryColors={categoryColors}
            groupBySemester
          />
        )}
        {activeTab.key === 'godkjenning' && (
          <WorkApprovalList {...approvals} categoryColors={categoryColors} />
        )}
        {activeTab.key === 'status' && (
          <Registatus key={statusVersion} onGrant={(row) => openGrant(row.id)} />
        )}
        {activeTab.key === 'logg' && <RegiLogsPanel categoryColors={categoryColors} />}
      </div>

      {!onManagerTab && (
        <button
          type="button"
          onClick={openRegister}
          aria-label="Registrer timer"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg hover:bg-primary-hover md:hidden"
        >
          <Plus aria-hidden="true" className="h-6 w-6" />
        </button>
      )}

      <TaskDialogs management={tasks} actions={taskActions} categoryColors={categoryColors} />

      <RegisterHoursSheet
        open={showRegister}
        onClose={closeRegister}
        onCreated={() => {
          closeRegister();
          setNotice('Registrert! Timene venter nå på godkjenning.');
          void logs.reload();
        }}
      />
      {isManager && (
        <GrantRegiSheet
          open={grant.open}
          userId={grant.userId}
          onClose={closeGrant}
          onCreated={() => {
            closeGrant();
            setNotice('Timene er registrert og godkjent.');
            setStatusVersion((version) => version + 1);
          }}
        />
      )}
    </PageLayout>
  );
};

const RegiHubPage: React.FC = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading || !user) return null;

  const activeTab = TABS.find((tab) => tab.path === pathname.replace(/\/$/, ''));
  // Unknown sub-paths and manager tabs opened by residents go to the overview.
  if (!activeTab || (activeTab.managerOnly && !canApproveWork(user.role))) {
    return <Navigate to={REGI_PATHS.REGI} replace />;
  }

  return (
    <RegiHubProvider user={user}>
      <RegiHub activeTab={activeTab} />
    </RegiHubProvider>
  );
};

export default RegiHubPage;
