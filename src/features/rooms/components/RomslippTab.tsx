import { useState } from 'react';
import { DoorClosed, Play } from 'lucide-react';
import type { RomslippController } from '../hooks/useRomslipp';
import {
  PARTICIPANT_STATUS_LABELS,
  canCloseRound,
  countMoves,
  describeAvailableRoom,
  describeOutcome,
  getAnsweredCount,
  getPeopleAhead,
  getTurn,
} from '../romslipp';
import type { AvailableRoom, RomslippParticipant, RomslippState } from '../types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Select,
  Skeleton,
  StatTile,
  StatusMessage,
  type BadgeTone,
} from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';
import { getSemester } from '../../../shared/utils/semester';

type RomslippTabProps = {
  romslipp: RomslippController;
  userId: string;
  canManage: boolean;
};

const STATUS_TONES: Record<RomslippParticipant['status'], BadgeTone> = {
  waiting: 'neutral',
  moved: 'success',
  stayed: 'info',
  skipped: 'warning',
};

// Picks one of the rooms that have space, or stays. Used by a resident on their own turn and by
// Romsjef answering for the resident whose turn it is.
const AnswerForm = ({
  available,
  busy,
  onAnswer,
  stayLabel,
  moveLabel,
}: {
  available: AvailableRoom[];
  busy: boolean;
  onAnswer: (roomId: string | null) => void;
  stayLabel: string;
  moveLabel: string;
}) => {
  const [roomId, setRoomId] = useState('');

  return (
    <div className="space-y-3">
      <Field label="Rom du kan flytte til" hint="Rommet ditt blir ledig for de neste i køen.">
        {(field) => (
          <Select {...field} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Velg et rom</option>
            {available.map((room) => (
              <option key={room.roomId} value={room.roomId}>
                {describeAvailableRoom(room)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {available.length === 0 && (
        <p className="text-sm text-muted">Ingen rom er ledige akkurat nå.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} disabled={!roomId} onClick={() => onAnswer(roomId)}>
          {moveLabel}
        </Button>
        <Button variant="secondary" loading={busy} onClick={() => onAnswer(null)}>
          {stayLabel}
        </Button>
      </div>
    </div>
  );
};

const OrderTable = ({
  participants,
  userId,
  turnUserId,
}: {
  participants: RomslippParticipant[];
  userId: string;
  turnUserId: string | undefined;
}) => (
  <DataTable<RomslippParticipant>
    rows={participants}
    getRowKey={(row) => row.userId}
    columns={[
      { key: 'position', header: '#', className: 'tabular-nums', render: (row) => row.position },
      {
        key: 'name',
        header: 'Beboer',
        render: (row) => (
          <span className={row.userId === userId ? 'font-semibold' : undefined}>
            {row.userName}
            {row.userId === userId && <span className="text-subtle"> (deg)</span>}
          </span>
        ),
      },
      {
        key: 'room',
        header: 'Rom nå',
        className: 'tabular-nums',
        render: (row) => row.fromRoomNumber ?? '–',
      },
      {
        key: 'status',
        header: 'Svar',
        render: (row) =>
          row.userId === turnUserId ? (
            <Badge tone="primary">På tur</Badge>
          ) : row.status === 'waiting' ? (
            <Badge>{PARTICIPANT_STATUS_LABELS.waiting}</Badge>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONES[row.status]}>{PARTICIPANT_STATUS_LABELS[row.status]}</Badge>
              <span className="text-sm text-muted">{describeOutcome(row)}</span>
            </span>
          ),
      },
    ]}
    renderCard={(row) => (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={row.userId === userId ? 'font-semibold' : 'font-medium'}>
            {row.position}. {row.userName}
          </p>
          <p className="text-sm text-muted">
            {row.status === 'waiting' ? `Rom ${row.fromRoomNumber ?? '–'}` : describeOutcome(row)}
          </p>
        </div>
        {row.userId === turnUserId ? (
          <Badge tone="primary">På tur</Badge>
        ) : (
          <Badge tone={STATUS_TONES[row.status]}>{PARTICIPANT_STATUS_LABELS[row.status]}</Badge>
        )}
      </div>
    )}
  />
);

const RoundView = ({
  state,
  available,
  romslipp,
  userId,
  canManage,
}: {
  state: RomslippState;
  available: AvailableRoom[];
  romslipp: RomslippController;
  userId: string;
  canManage: boolean;
}) => {
  const [confirming, setConfirming] = useState<'close' | 'cancel' | null>(null);
  const { participants, round } = state;
  const isOpen = round.status === 'open';
  const turn = getTurn(participants);
  const ahead = getPeopleAhead(participants, userId);
  const mine = participants.find((participant) => participant.userId === userId);
  const myTurn = isOpen && turn?.userId === userId;

  const openConfirm = (kind: 'close' | 'cancel') => {
    romslipp.clearError();
    setConfirming(kind);
  };

  const confirm = async () => {
    const ok = confirming === 'close' ? await romslipp.close() : await romslipp.cancel();
    if (ok) setConfirming(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Har svart"
          value={`${getAnsweredCount(participants)} av ${participants.length}`}
          progress={
            participants.length > 0 ? getAnsweredCount(participants) / participants.length : 0
          }
        />
        <StatTile
          label={isOpen ? 'På tur nå' : 'Status'}
          value={
            isOpen
              ? (turn?.userName ?? 'Ingen igjen')
              : round.status === 'closed'
                ? 'Avsluttet'
                : 'Avbrutt'
          }
          hint={
            isOpen
              ? turn
                ? `Rom ${turn.fromRoomNumber ?? '–'}`
                : 'Alle har svart. Romsjef kan avslutte.'
              : round.closedAt
                ? formatDate(round.closedAt)
                : undefined
          }
          tone="info"
        />
        <StatTile label="Flytter" value={countMoves(participants)} tone="success" />
      </div>

      {myTurn && (
        <Card
          title="Det er din tur"
          description="Velg et ledig rom du vil flytte til, eller bli boende der du er."
        >
          <AnswerForm
            available={available}
            busy={romslipp.busy}
            onAnswer={(roomId) => void romslipp.answer(roomId)}
            moveLabel="Flytt til valgt rom"
            stayLabel="Jeg blir boende"
          />
        </Card>
      )}

      {isOpen && !myTurn && mine && ahead !== null && (
        <StatusMessage tone="info">
          Du er nummer {mine.position} i køen. {ahead} {ahead === 1 ? 'beboer' : 'beboere'} skal
          svare før deg.
        </StatusMessage>
      )}
      {isOpen && mine && mine.status !== 'waiting' && (
        <StatusMessage tone="success">Du har svart: {describeOutcome(mine)}.</StatusMessage>
      )}
      {isOpen && !mine && (
        <StatusMessage tone="info">
          Du er ikke med i dette romslippet. Beboere uten rom, på permisjon og Husfar står utenfor.
        </StatusMessage>
      )}

      {isOpen && canManage && (
        <Card
          title="Romsjef"
          description="Rommene byttes først når du avslutter romslippet."
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openConfirm('cancel')}
                disabled={romslipp.busy}
              >
                Avbryt romslipp
              </Button>
              <Button
                size="sm"
                onClick={() => openConfirm('close')}
                disabled={romslipp.busy || !canCloseRound(participants)}
              >
                Avslutt romslipp
              </Button>
            </>
          }
        >
          {turn ? (
            <div className="space-y-3">
              <p className="text-sm">
                Svar for <span className="font-medium">{turn.userName}</span> (rom{' '}
                {turn.fromRoomNumber ?? '–'}) hvis vedkommende ikke kan svare selv.
              </p>
              <AnswerForm
                available={available}
                busy={romslipp.busy}
                onAnswer={(roomId) => void romslipp.answer(roomId, turn.userId)}
                moveLabel={`Flytt ${turn.userName}`}
                stayLabel={`${turn.userName} blir boende`}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={romslipp.busy}
                onClick={() => void romslipp.skip(turn.userId)}
              >
                Hopp over {turn.userName}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Alle har svart. Avslutt romslippet for å flytte beboerne.
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Rekkefølge" description="Eldst ansiennitet først." className="lg:col-span-2">
          <OrderTable
            participants={participants}
            userId={userId}
            turnUserId={isOpen ? turn?.userId : undefined}
          />
        </Card>
        {isOpen && (
          <Card title="Ledige rom" description="Slik det ser ut akkurat nå.">
            {available.length === 0 ? (
              <p className="text-sm text-subtle">Ingen rom er ledige.</p>
            ) : (
              <ul className="divide-y divide-border">
                {available.map((room) => (
                  <li key={room.roomId} className="py-2 text-sm">
                    {describeAvailableRoom(room)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirming === 'close'}
        title="Avslutte romslippet?"
        confirmLabel="Avslutt og flytt"
        loading={romslipp.busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(null)}
      >
        <div className="space-y-3">
          {romslipp.error && <StatusMessage tone="error">{romslipp.error}</StatusMessage>}
          <p>
            {countMoves(participants)} beboere flytter til rommene de valgte. Flyttingene får dagens
            dato i romhistorikken.
          </p>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'cancel'}
        title="Avbryte romslippet?"
        confirmLabel="Avbryt romslipp"
        tone="danger"
        loading={romslipp.busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(null)}
      >
        <div className="space-y-3">
          {romslipp.error && <StatusMessage tone="error">{romslipp.error}</StatusMessage>}
          <p>Svarene forkastes og ingen flytter. Du kan starte et nytt romslipp etterpå.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
};

const RomslippTab = ({ romslipp, userId, canManage }: RomslippTabProps) => {
  const [starting, setStarting] = useState(false);
  const { state, loading } = romslipp;
  const semester = getSemester();

  if (loading) return <Skeleton className="h-64" />;

  const noRoundRunning = !state || state.round.status !== 'open';

  return (
    <div className="space-y-6">
      {romslipp.error && !starting && (
        <StatusMessage tone="error" onDismiss={romslipp.clearError}>
          {romslipp.error}
        </StatusMessage>
      )}

      {noRoundRunning && (
        <EmptyState
          title="Ingen romslipp pågår"
          icon={<DoorClosed aria-hidden="true" className="h-6 w-6" />}
          action={
            canManage ? (
              <Button
                icon={<Play aria-hidden="true" className="h-4 w-4" />}
                onClick={() => {
                  romslipp.clearError();
                  setStarting(true);
                }}
                disabled={romslipp.busy}
              >
                Start romslipp
              </Button>
            ) : undefined
          }
        >
          {canManage
            ? `Alle ledige rom blir tilgjengelige, og beboerne svarer etter tur, eldst ansiennitet først.`
            : 'Romsjef starter romslippet hvert semester. Du får beskjed på Hjem når det er din tur.'}
        </EmptyState>
      )}

      {state && (
        <>
          {state.round.status !== 'open' && (
            <h2 className="text-lg font-semibold">
              Siste romslipp ({state.round.semesterKey}) –{' '}
              {state.round.status === 'closed' ? 'avsluttet' : 'avbrutt'}
            </h2>
          )}
          <RoundView
            state={state}
            available={romslipp.available}
            romslipp={romslipp}
            userId={userId}
            canManage={canManage}
          />
        </>
      )}

      <ConfirmDialog
        open={starting}
        title="Starte romslipp?"
        confirmLabel="Start romslipp"
        loading={romslipp.busy}
        onConfirm={() => void romslipp.start(semester.key).then((ok) => ok && setStarting(false))}
        onCancel={() => setStarting(false)}
      >
        <div className="space-y-3">
          {romslipp.error && <StatusMessage tone="error">{romslipp.error}</StatusMessage>}
          <p>
            Beboere med rom, som ikke er på permisjon eller Husfar, får svare i rekkefølge etter
            ansiennitet. Mens romslippet pågår kan ikke rom tildeles for hånd.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default RomslippTab;
