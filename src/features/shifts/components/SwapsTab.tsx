import { ArrowRightLeft } from 'lucide-react';
import { addDays, formatDayMonth, formatWeekday, isSameDay } from '../calendar';
import { SLOT_LABELS, SLOT_NAMES } from '../slots';
import { formatKroner, getOpenSwaps } from '../swaps';
import type { Shift, SwapLogEntry } from '../types';
import { Badge, Button, Card, Checkbox, EmptyState, Skeleton } from '../../../shared/components';

type SwapsTabProps = {
  shifts: Shift[];
  log: SwapLogEntry[];
  loading: boolean;
  busy: boolean;
  userId: string;
  onClaim: (shift: Shift) => void;
  onManageMine: (shift: Shift) => void;
  onMarkPaid: (logId: string, paid: boolean) => void;
  now?: Date;
};

const describe = (shift: Pick<Shift, 'startsAt' | 'slotType'>, now: Date) => {
  const day = isSameDay(shift.startsAt, now)
    ? 'I dag'
    : isSameDay(shift.startsAt, addDays(now, 1))
      ? 'I morgen'
      : `${formatWeekday(shift.startsAt)} ${formatDayMonth(shift.startsAt)}`;
  return `${day} · ${SLOT_NAMES[shift.slotType]} ${SLOT_LABELS[shift.slotType]}`;
};

const SwapsTab = ({
  shifts,
  log,
  loading,
  busy,
  userId,
  onClaim,
  onManageMine,
  onMarkPaid,
  now = new Date(),
}: SwapsTabProps) => {
  const open = getOpenSwaps(shifts, userId, now);
  const mine = shifts.filter(
    (shift) => shift.userId === userId && shift.swapRequested && shift.startsAt > now
  );

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Card title="Ledige bytter" description="Vakter andre trenger at noen tar over.">
        {open.length === 0 ? (
          <EmptyState
            title="Ingen vakter til bytte"
            icon={<ArrowRightLeft aria-hidden="true" className="h-6 w-6" />}
          >
            Når noen ber om bytte, dukker vakten opp her.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {open.map((shift) => (
              <li key={shift.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{describe(shift, now)}</p>
                  <p className="truncate text-sm text-muted">
                    {shift.userName ?? 'Ukjent'}
                    {shift.swapNote ? ` · ${shift.swapNote}` : ''}
                  </p>
                </div>
                {shift.swapOfferAmount ? (
                  <Badge tone="success">{formatKroner(shift.swapOfferAmount)}</Badge>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => onClaim(shift)}
                  aria-label={`Ta vakt ${describe(shift, now)}`}
                >
                  Ta vakten
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mine.length > 0 && (
        <Card title="Dine vakter til bytte" description="Venter på at noen tar over.">
          <ul className="divide-y divide-border">
            {mine.map((shift) => (
              <li key={shift.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{describe(shift, now)}</p>
                  {shift.swapNote && (
                    <p className="truncate text-sm text-muted">{shift.swapNote}</p>
                  )}
                </div>
                {shift.swapOfferAmount ? (
                  <Badge tone="success">{formatKroner(shift.swapOfferAmount)}</Badge>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => onManageMine(shift)}>
                  Endre
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Tidligere bytter"
        description="Bytter du har gitt bort eller tatt. Pengene gjør dere opp utenfor appen."
      >
        {log.length === 0 ? (
          <p className="text-sm text-subtle">Du har ikke byttet noen vakter ennå.</p>
        ) : (
          <ul className="divide-y divide-border">
            {log.map((entry) => {
              const gaveAway = entry.fromUserId === userId;
              const other = gaveAway ? entry.toUserName : entry.fromUserName;
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {describe({ startsAt: entry.shiftStartsAt, slotType: entry.slotType }, now)}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {gaveAway ? 'Gitt til' : 'Tatt fra'} {other ?? 'ukjent'}
                    </p>
                  </div>
                  {entry.amount ? (
                    <>
                      <span className="text-sm tabular-nums">
                        {gaveAway ? 'Du betaler' : 'Du får'} {formatKroner(entry.amount)}
                      </span>
                      <Checkbox
                        label="Betalt"
                        checked={entry.paid}
                        disabled={busy}
                        onChange={(event) => onMarkPaid(entry.id, event.target.checked)}
                      />
                    </>
                  ) : (
                    <Badge>Uten betaling</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default SwapsTab;
