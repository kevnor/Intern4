import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RotateCcw, UserPlus } from 'lucide-react';
import { getResidentDirectoryUsers, reactivateUser } from '../../../server/dao/userDAO';
import { useAuth } from '../../../app/providers/AuthContext';
import { PageLayout } from '../../../shared/layouts';
import { ResidentDirectoryUser } from '../../../shared/types/user';
import { formatDate } from '../../../shared/utils/date';
import { formatPhoneDisplay, toPhoneHref } from '../../../shared/utils/phone';
import { cn } from '../../../shared/utils/cn';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  SearchInput,
  SectionTabs,
  Select,
  Skeleton,
  StatusMessage,
} from '../../../shared/components';
import { RESIDENT_PATHS, residentProfilePath } from '../paths';
import {
  ResidentSortKey,
  buildStatistics,
  filterResidents,
  formatAddress,
  formatRoom,
  formatStudy,
  sortResidents,
} from '../residentDirectory';
import ContactActions from '../components/ContactActions';
import NewUserModal, { CreatedUser } from '../components/NewUserModal';
import CreatedUserDialog from '../components/CreatedUserDialog';
import { useProfilePictureUrls } from '../hooks/useProfilePictureUrls';
import { useUserAdminLookups } from '../hooks/useUserAdminLookups';
import { canAccessRoomManagement } from '../../users/permissions';

// The charts library is large, so it only loads when Statistikk is opened.
const StatisticsDashboard = lazy(() =>
  import('../components/ResidentStatistics').then((module) => ({
    default: module.StatisticsDashboard,
  }))
);

const TABS = [
  { key: 'list', label: 'Beboerliste', path: RESIDENT_PATHS.BEBOERE },
  { key: 'stats', label: 'Statistikk', path: RESIDENT_PATHS.BEBOER_STATISTIKK },
  { key: 'old', label: 'Gamle beboere', path: RESIDENT_PATHS.GAMLE_BEBOERE },
] as const;

const SORT_OPTIONS: { value: ResidentSortKey; label: string }[] = [
  { value: 'name', label: 'Navn' },
  { value: 'room', label: 'Rom' },
  { value: 'seniority', label: 'Ansiennitet' },
];

const stretchedLinkClasses =
  'after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring';

const ResidentCard = ({
  resident,
  photoUrl,
}: {
  resident: ResidentDirectoryUser;
  photoUrl?: string;
}) => (
  <article className="relative space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <Avatar name={resident.name} src={photoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={residentProfilePath(resident.id)}
            className={cn('font-semibold', stretchedLinkClasses)}
          >
            {resident.name}
          </Link>
          {formatRoom(resident.roomNumber) !== '-' && (
            <Badge tone="primary">Rom {formatRoom(resident.roomNumber)}</Badge>
          )}
          {resident.onLeave && <Badge tone="warning">Permisjon</Badge>}
        </div>
        {formatStudy(resident) !== '-' && (
          <p className="mt-0.5 text-sm text-muted">{formatStudy(resident)}</p>
        )}
        {resident.phone && (
          <p className="text-sm text-subtle">{formatPhoneDisplay(resident.phone)}</p>
        )}
      </div>
    </div>
    <ContactActions name={resident.name} phone={resident.phone} email={resident.email} />
  </article>
);

const ResidentDirectoryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = canAccessRoomManagement(user?.role);
  const activeTab = TABS.find((tab) => tab.path === location.pathname)?.key ?? 'list';
  const showOldResidents = activeTab === 'old';
  const showStatistics = activeTab === 'stats';
  const [residents, setResidents] = useState<ResidentDirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<ResidentSortKey>('name');
  const [roleFilter, setRoleFilter] = useState('all');
  const [onLeaveOnly, setOnLeaveOnly] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [reactivateCandidate, setReactivateCandidate] = useState<ResidentDirectoryUser | null>(
    null
  );
  const [reactivating, setReactivating] = useState(false);
  const lookups = useUserAdminLookups(isManager);
  const photoUrls = useProfilePictureUrls(showOldResidents ? [] : residents);

  // isCurrent lets a slower request from a previous tab be ignored after switching tabs.
  const loadResidents = useCallback(
    async (isCurrent: () => boolean = () => true): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await getResidentDirectoryUsers(!showOldResidents);
        if (isCurrent()) setResidents(data);
      } catch (err) {
        console.error(err);
        if (isCurrent()) setError('Kunne ikke laste beboere.');
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [showOldResidents]
  );

  useEffect(() => {
    let current = true;
    void loadResidents(() => current);
    return () => {
      current = false;
    };
  }, [loadResidents]);

  const availableRoles = useMemo(
    () =>
      Array.from(
        new Set(residents.map((resident) => resident.role).filter(Boolean))
      ).sort() as string[],
    [residents]
  );

  const visibleResidents = useMemo(() => {
    const searched = filterResidents(residents, query, showOldResidents);
    const filtered = searched.filter(
      (resident) =>
        (roleFilter === 'all' || resident.role === roleFilter) && (!onLeaveOnly || resident.onLeave)
    );
    return sortResidents(filtered, sortKey);
  }, [onLeaveOnly, query, residents, roleFilter, showOldResidents, sortKey]);

  const statistics = useMemo(() => buildStatistics(residents), [residents]);

  const confirmReactivate = async () => {
    if (!reactivateCandidate) return;
    setReactivating(true);
    try {
      await reactivateUser(reactivateCandidate.id);
      setNotice(`${reactivateCandidate.name} er aktiv igjen.`);
      void loadResidents();
    } catch (reactivateError) {
      setError(
        reactivateError instanceof Error ? reactivateError.message : 'Kunne ikke reaktivere bruker'
      );
    } finally {
      setReactivating(false);
      setReactivateCandidate(null);
    }
  };

  const title = showStatistics ? 'Statistikk' : showOldResidents ? 'Gamle beboere' : 'Beboerliste';
  const description = showStatistics
    ? 'Fordeling for nåværende beboere etter alder, studieår, botid og studieprogram.'
    : showOldResidents
      ? 'Oversikt over tidligere beboere og registrert adresseinformasjon.'
      : 'Kontaktinformasjon og basisinfo for nåværende beboere.';

  const loadingState = (
    <div aria-label="Laster beboere" aria-busy="true" className="space-y-3">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-28 rounded-2xl md:h-12" />
      ))}
    </div>
  );

  const nameLink = (resident: ResidentDirectoryUser) => (
    <Link
      to={residentProfilePath(resident.id)}
      className="font-medium hover:text-primary hover:underline"
    >
      {resident.name}
    </Link>
  );

  const reactivateButton = (resident: ResidentDirectoryUser) =>
    isManager ? (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setReactivateCandidate(resident)}
        aria-label={`Reaktiver ${resident.name}`}
        icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
        className="relative z-10"
      >
        Reaktiver
      </Button>
    ) : null;

  return (
    <PageLayout
      title={title}
      description={description}
      actions={
        isManager && !showStatistics ? (
          <Button
            icon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setShowNewUser(true)}
          >
            Ny beboer
          </Button>
        ) : undefined
      }
    >
      <SectionTabs
        label="Beboere"
        tabs={TABS.map(({ key, label }) => ({ key, label }))}
        activeKey={activeTab}
        onChange={(key) => navigate(TABS.find((tab) => tab.key === key)!.path)}
      />

      {error && (
        <StatusMessage tone="error" onDismiss={() => setError(null)}>
          {error}
        </StatusMessage>
      )}
      {notice && (
        <StatusMessage tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </StatusMessage>
      )}

      {showStatistics ? (
        loading ? (
          loadingState
        ) : residents.length === 0 ? (
          <EmptyState title="Ingen beboere funnet." />
        ) : (
          <Suspense fallback={loadingState}>
            <StatisticsDashboard statistics={statistics} />
          </Suspense>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Søk etter beboere"
              placeholder={
                showOldResidents
                  ? 'Søk etter navn, adresse eller postnummer...'
                  : 'Søk etter navn, rom, telefon, e-post, studie eller rolle...'
              }
              className="flex-1"
            />
            {!showOldResidents && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[calc(50%-0.25rem)] sm:w-48">
                  <Select
                    aria-label="Sortering"
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as ResidentSortKey)}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {isManager && (
                  <>
                    <div className="w-[calc(50%-0.25rem)] sm:w-48">
                      <Select
                        aria-label="Filtrer på rolle"
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value)}
                      >
                        <option value="all">Alle roller</option>
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <button
                      type="button"
                      aria-pressed={onLeaveOnly}
                      onClick={() => setOnLeaveOnly((current) => !current)}
                      className={cn(
                        'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                        onLeaveOnly
                          ? 'border-primary bg-primary-subtle text-primary-subtle-fg'
                          : 'border-border bg-surface text-muted hover:text-fg'
                      )}
                    >
                      Permisjon
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            loadingState
          ) : showOldResidents ? (
            <DataTable
              rows={visibleResidents}
              getRowKey={(resident) => resident.id}
              emptyMessage="Ingen gamle beboere funnet."
              bareCards
              renderCard={(resident) => (
                <article className="relative flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <div className="min-w-0">
                    <Link
                      to={residentProfilePath(resident.id)}
                      className={cn('font-semibold', stretchedLinkClasses)}
                    >
                      {resident.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {formatAddress(resident)}
                      {resident.address.postalCode && ` · ${resident.address.postalCode}`}
                    </p>
                  </div>
                  {reactivateButton(resident)}
                </article>
              )}
              columns={[
                { key: 'name', header: 'Navn', render: nameLink },
                {
                  key: 'address',
                  header: 'Adresse',
                  render: (resident) => formatAddress(resident),
                },
                {
                  key: 'postalCode',
                  header: 'Postnummer',
                  render: (resident) => resident.address.postalCode || '-',
                },
                ...(isManager
                  ? [
                      {
                        key: 'actions',
                        header: <span className="sr-only">Handlinger</span>,
                        render: reactivateButton,
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <DataTable
              rows={visibleResidents}
              getRowKey={(resident) => resident.id}
              emptyMessage="Ingen beboere funnet."
              bareCards
              renderCard={(resident) => (
                <ResidentCard resident={resident} photoUrl={photoUrls[resident.id]} />
              )}
              columns={[
                {
                  key: 'name',
                  header: 'Navn',
                  className: 'whitespace-nowrap',
                  render: (resident) => (
                    <span className="flex items-center gap-3">
                      <Avatar name={resident.name} src={photoUrls[resident.id]} size="sm" />
                      {nameLink(resident)}
                      {resident.onLeave && <Badge tone="warning">Permisjon</Badge>}
                    </span>
                  ),
                },
                {
                  key: 'room',
                  header: 'Rom',
                  render: (resident) => formatRoom(resident.roomNumber),
                },
                {
                  key: 'phone',
                  header: 'Telefon',
                  className: 'whitespace-nowrap',
                  render: (resident) =>
                    resident.phone ? (
                      <a
                        href={`tel:${toPhoneHref(resident.phone)}`}
                        className="text-primary hover:underline"
                      >
                        {formatPhoneDisplay(resident.phone)}
                      </a>
                    ) : (
                      '-'
                    ),
                },
                {
                  key: 'email',
                  header: 'E-post',
                  render: (resident) =>
                    resident.email ? (
                      <a href={`mailto:${resident.email}`} className="text-primary hover:underline">
                        {resident.email}
                      </a>
                    ) : (
                      '-'
                    ),
                },
                { key: 'study', header: 'Studie', render: (resident) => formatStudy(resident) },
                {
                  key: 'seniority',
                  header: 'Ansiennitet',
                  className: 'tabular-nums',
                  render: (resident) => resident.seniority,
                },
                {
                  key: 'born',
                  header: 'Født',
                  className: 'whitespace-nowrap',
                  render: (resident) => formatDate(resident.birthDate),
                },
                {
                  key: 'role',
                  header: 'Rolle',
                  render: (resident) => <Badge>{resident.role ?? 'Ingen rolle'}</Badge>,
                },
              ]}
            />
          )}

          {!loading && (
            <p className="text-sm text-subtle">
              Viser {visibleResidents.length} av {residents.length}{' '}
              {showOldResidents ? 'gamle beboere' : 'beboere'}
            </p>
          )}
        </div>
      )}

      {isManager && (
        <>
          <NewUserModal
            open={showNewUser}
            onClose={() => setShowNewUser(false)}
            onCreated={(created) => {
              setShowNewUser(false);
              setCreatedUser(created);
              void loadResidents();
            }}
            roles={lookups.roles}
            rolesLoading={lookups.loading}
            schools={lookups.schools}
            studies={lookups.studies}
            lookupsLoading={lookups.loading}
          />
          <CreatedUserDialog user={createdUser} onClose={() => setCreatedUser(null)} />
          <ConfirmDialog
            open={!!reactivateCandidate}
            title="Reaktivere beboer?"
            confirmLabel="Reaktiver"
            loading={reactivating}
            onCancel={() => setReactivateCandidate(null)}
            onConfirm={() => void confirmReactivate()}
          >
            <strong className="text-fg">{reactivateCandidate?.name}</strong> blir aktiv beboer igjen
            og kan logge inn med sitt gamle passord.
          </ConfirmDialog>
        </>
      )}
    </PageLayout>
  );
};

export default ResidentDirectoryPage;
