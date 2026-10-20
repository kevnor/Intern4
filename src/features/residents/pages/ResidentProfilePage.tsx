import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, RotateCcw, UserMinus } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthContext';
import { deleteUser, reactivateUser, updateUser } from '../../../server/dao/userDAO';
import { PageLayout } from '../../../shared/layouts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  StatusMessage,
  buttonClasses,
} from '../../../shared/components';
import { formatDate, formatHours } from '../../../shared/utils/date';
import { formatPhoneDisplay } from '../../../shared/utils/phone';
import { cn } from '../../../shared/utils/cn';
import { USER_ROLES } from '../../../shared/types/roles';
import { RESIDENT_PATHS } from '../paths';
import { formatAddress, formatRoom, formatStudy } from '../residentDirectory';
import ContactActions from '../components/ContactActions';
import EditResidentSheet from '../components/EditResidentSheet';
import { useResidentProfile, type ResidentProfile } from '../hooks/useResidentProfile';
import { useUserAdminLookups } from '../hooks/useUserAdminLookups';
import { canAccessRoomManagement } from '../../users/permissions';
import { USER_PATHS } from '../../users/paths';
import { canApproveWork } from '../../regi/permissions';
import { REGI_PATHS } from '../../regi/paths';
import { summarizeSemesterRegi } from '../../regi/regiSummary';
import { useSemesterHours } from '../../regi/hooks/useSemesterHours';
import { useVaktHours } from '../../shifts/hooks/useVaktHours';
import { useUserRoomHistory } from '../../rooms/hooks/useOccupancyHistory';
import RoomHistoryList from '../../rooms/components/RoomHistoryList';
import { hasVakt } from '../../shifts/vaktSummary';

const ageFrom = (birthDate?: Date) => {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
};

const StatusBadge = ({ resident }: { resident: ResidentProfile }) =>
  !resident.isActive ? (
    <Badge>Tidligere beboer</Badge>
  ) : resident.onLeave ? (
    <Badge tone="warning">Permisjon</Badge>
  ) : (
    <Badge tone="success">Aktiv</Badge>
  );

const DetailList = ({ items }: { items: { label: string; value: React.ReactNode }[] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.label}>
        <dt className="text-xs font-medium text-muted">{item.label}</dt>
        <dd className="text-sm">{item.value}</dd>
      </div>
    ))}
  </dl>
);

type PendingAction = 'leave' | 'deactivate' | 'reactivate' | null;

const ResidentProfilePage: React.FC = () => {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const isManager = canAccessRoomManagement(user?.role);
  const isRegiManager = canApproveWork(user?.role);
  const showAdmin = isManager || isRegiManager;
  const { profile, photoUrl, logs, loading, notFound, error, reload } = useResidentProfile(
    id,
    showAdmin
  );
  const lookups = useUserAdminLookups(isManager);
  const [editing, setEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const isSelf = user?.id === id;
  const { totalHours } = useSemesterHours();
  const roomHistory = useUserRoomHistory(id || undefined);
  const { summary: vakt } = useVaktHours(id || undefined, profile?.role, totalHours);
  const summary = useMemo(
    () => (profile ? summarizeSemesterRegi(logs, profile.role, new Date(), totalHours) : null),
    [logs, profile, totalHours]
  );

  const backLink = (
    <Link
      to={profile?.isActive === false ? RESIDENT_PATHS.GAMLE_BEBOERE : RESIDENT_PATHS.BEBOERE}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {profile?.isActive === false ? 'Gamle beboere' : 'Beboerliste'}
    </Link>
  );

  if (loading) {
    return (
      <PageLayout title="Beboer">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </PageLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <PageLayout title="Beboer">
        {backLink}
        {error ? (
          <StatusMessage tone="error">{error}</StatusMessage>
        ) : (
          <EmptyState title="Fant ikke beboeren">Lenken kan være feil eller utdatert.</EmptyState>
        )}
      </PageLayout>
    );
  }

  // Admins can't be deactivated, and nobody deactivates themselves (the server refuses both).
  const canDeactivate =
    isManager && profile.isActive && !isSelf && profile.role !== USER_ROLES.ADMIN;
  const age = ageFrom(profile.birthDate);

  const runAction = async () => {
    setWorking(true);
    try {
      if (pendingAction === 'leave') {
        await updateUser(id, { onLeave: !profile.onLeave });
        setMessage({
          tone: 'success',
          text: profile.onLeave ? 'Permisjonen er avsluttet.' : 'Satt på permisjon.',
        });
      } else if (pendingAction === 'deactivate') {
        await deleteUser(id);
        setMessage({ tone: 'success', text: `${profile.name} er deaktivert.` });
      } else if (pendingAction === 'reactivate') {
        await reactivateUser(id);
        setMessage({ tone: 'success', text: `${profile.name} er aktiv igjen.` });
      }
      await reload();
    } catch (actionError) {
      setMessage({
        tone: 'error',
        text: actionError instanceof Error ? actionError.message : 'Noe gikk galt.',
      });
    } finally {
      setWorking(false);
      setPendingAction(null);
    }
  };

  const confirmCopy: Record<
    Exclude<PendingAction, null>,
    { title: string; label: string; body: string }
  > = {
    leave: profile.onLeave
      ? {
          title: 'Avslutte permisjon?',
          label: 'Avslutt permisjon',
          body: `${profile.name} regnes som aktiv beboer igjen.`,
        }
      : {
          title: 'Sette på permisjon?',
          label: 'Sett på permisjon',
          body: `${profile.name} får status permisjon og vises med det i beboerlisten.`,
        },
    deactivate: {
      title: 'Deaktivere beboer?',
      label: 'Deaktiver',
      body: `${profile.name} mister innloggingen og flyttes til Gamle beboere. Historikken beholdes, og beboeren kan reaktiveres senere.`,
    },
    reactivate: {
      title: 'Reaktivere beboer?',
      label: 'Reaktiver',
      body: `${profile.name} blir aktiv beboer igjen og kan logge inn med sitt gamle passord.`,
    },
  };

  return (
    <PageLayout title={profile.name}>
      {backLink}

      {message && (
        <StatusMessage tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </StatusMessage>
      )}

      <Card>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar name={profile.name} src={photoUrl} size="xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {formatRoom(profile.roomNumber) !== '-' && (
                <Badge tone="primary">Rom {formatRoom(profile.roomNumber)}</Badge>
              )}
              {profile.role && <Badge>{profile.role}</Badge>}
              <StatusBadge resident={profile} />
            </div>
            <ContactActions
              name={profile.name}
              phone={profile.phone}
              email={profile.email}
              className="justify-center sm:justify-start"
            />
            {isSelf && (
              <Link
                to={USER_PATHS.PROFILE}
                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Rediger profil
              </Link>
            )}
          </div>
        </div>
      </Card>

      <Card title="Om beboeren">
        <DetailList
          items={[
            {
              label: 'Studie',
              value: formatStudy(profile) === '-' ? '–' : formatStudy(profile),
            },
            {
              label: 'Ansiennitet',
              value: `${profile.seniority} ${profile.seniority === 1 ? 'semester' : 'semestre'}`,
            },
            {
              label: 'Født',
              value: profile.birthDate
                ? `${formatDate(profile.birthDate)}${age !== null ? ` (${age} år)` : ''}`
                : '–',
            },
            { label: 'Telefon', value: profile.phone ? formatPhoneDisplay(profile.phone) : '–' },
            { label: 'E-post', value: profile.email || '–' },
          ]}
        />
      </Card>

      <Card title="Romhistorikk" description="Rommene beboeren har bodd i.">
        {roomHistory.loading ? (
          <Skeleton className="h-16" />
        ) : roomHistory.error ? (
          <p className="text-sm text-danger">{roomHistory.error}</p>
        ) : (
          <RoomHistoryList
            stays={roomHistory.stays}
            subject="room"
            emptyText="Ingen rom registrert."
          />
        )}
      </Card>

      {showAdmin && (
        <Card
          title="Administrasjon"
          description="Vises bare for romsjef, regisjef, Data og Admin."
          actions={
            isManager ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => setEditing(true)}
                >
                  Rediger
                </Button>
                {profile.isActive && (
                  <Button variant="secondary" size="sm" onClick={() => setPendingAction('leave')}>
                    {profile.onLeave ? 'Avslutt permisjon' : 'Sett på permisjon'}
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<UserMinus aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => setPendingAction('deactivate')}
                    className="text-danger hover:bg-danger-subtle hover:text-danger"
                  >
                    Deaktiver
                  </Button>
                )}
                {!profile.isActive && (
                  <Button
                    size="sm"
                    icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => setPendingAction('reactivate')}
                  >
                    Reaktiver
                  </Button>
                )}
              </>
            ) : undefined
          }
        >
          <div className="space-y-5">
            <DetailList
              items={[
                {
                  label: 'Hjemadresse',
                  value: formatAddress(profile) === '-' ? '–' : formatAddress(profile),
                },
                { label: 'Postnummer', value: profile.address.postalCode || '–' },
              ]}
            />
            {summary && profile.isActive && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">Regi dette semesteret</p>
                  <p className="text-sm tabular-nums">
                    {formatHours(summary.approved)}
                    {summary.required > 0 && (
                      <span className="text-subtle"> / {formatHours(summary.required)}</span>
                    )}
                    {summary.pending > 0 && (
                      <span className="text-muted"> · {formatHours(summary.pending)} venter</span>
                    )}
                  </p>
                </div>
                {summary.required > 0 && (
                  <div
                    role="meter"
                    aria-label="Godkjente regitimer av kravet"
                    aria-valuemin={0}
                    aria-valuemax={summary.required}
                    aria-valuenow={Math.min(summary.approved, summary.required)}
                    className="h-2 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full',
                        summary.remaining === 0 ? 'bg-success' : 'bg-primary'
                      )}
                      style={{
                        width: `${Math.round(Math.min(summary.approved / summary.required, 1) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {hasVakt(vakt) && (
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">Vakt dette semesteret</p>
                      <p className="text-sm tabular-nums">
                        {formatHours(vakt.done)}
                        {vakt.required > 0 && (
                          <span className="text-subtle"> / {formatHours(vakt.required)}</span>
                        )}
                      </p>
                    </div>
                    {vakt.required > 0 && (
                      <div
                        role="meter"
                        aria-label="Vakttimer av kravet"
                        aria-valuemin={0}
                        aria-valuemax={vakt.required}
                        aria-valuenow={Math.min(vakt.done, vakt.required)}
                        className="h-2 overflow-hidden rounded-full bg-surface-muted"
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            vakt.remaining === 0 ? 'bg-success' : 'bg-primary'
                          )}
                          style={{
                            width: `${Math.round(Math.min(vakt.done / vakt.required, 1) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
                {isRegiManager && (
                  <Link
                    to={REGI_PATHS.STATUS}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Åpne registatus
                  </Link>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {isManager && editing && (
        <EditResidentSheet
          open
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setMessage({ tone: 'success', text: 'Endringene er lagret.' });
            void reload();
          }}
          resident={profile}
          callerRole={user?.role}
          isSelf={isSelf}
          roles={lookups.roles}
          schools={lookups.schools}
          studies={lookups.studies}
          rooms={lookups.rooms}
        />
      )}

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction ? confirmCopy[pendingAction].title : ''}
        confirmLabel={pendingAction ? confirmCopy[pendingAction].label : ''}
        tone={pendingAction === 'deactivate' ? 'danger' : 'primary'}
        loading={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void runAction()}
      >
        {pendingAction && confirmCopy[pendingAction].body}
      </ConfirmDialog>
    </PageLayout>
  );
};

export default ResidentProfilePage;
