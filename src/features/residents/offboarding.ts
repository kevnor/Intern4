import {
  formatDateColumnValue,
  formatDeadline,
  parseDateColumnValue,
} from '../../shared/utils/date';

// What moving someone out will do, as counted by the database (offboarding_preview).
export type OffboardingPreview = {
  roomNumber: number | null;
  futureShifts: number;
  openSwaps: number;
  waitingRomslipp: number;
  openReports: number;
  roleReset: string | null;
};

export type ResidentEventKind =
  | 'added'
  | 'move_out_planned'
  | 'move_out_cancelled'
  | 'moved_out'
  | 'reactivated';

export type ResidentEvent = {
  id: string;
  kind: ResidentEventKind;
  actorName: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

// An event in the feed for everyone, so it also says which resident it is about.
export type ResidentFeedEvent = ResidentEvent & { userId: string; residentName: string };

// The lines of the confirmation: only what applies to this resident.
export const describeOffboarding = (preview: OffboardingPreview): string[] => {
  const lines: string[] = [];

  if (preview.roomNumber) lines.push(`Rom ${preview.roomNumber} blir ledig.`);

  if (preview.futureShifts > 0) {
    const swaps = preview.openSwaps > 0 ? ` (${preview.openSwaps} lå ute for bytte)` : '';
    lines.push(
      preview.futureShifts === 1
        ? `1 vakt frem i tid blir ledig${swaps}, og Vaktsjef må fylle den.`
        : `${preview.futureShifts} vakter frem i tid blir ledige${swaps}, og Vaktsjef må fylle dem.`
    );
  }

  if (preview.waitingRomslipp > 0) lines.push('Hoppes over i romslippet som pågår.');
  if (preview.roleReset) lines.push(`Rollen ${preview.roleReset} settes tilbake til Halv/Halv.`);
  if (preview.openReports > 0) {
    lines.push(
      preview.openReports === 1
        ? '1 åpen romrapport blir liggende.'
        : `${preview.openReports} åpne romrapporter blir liggende.`
    );
  }

  lines.push('Innloggingen sperres, med Microsoft og passord.');
  return lines;
};

const count = (value: unknown, one: string, many: string): string | null =>
  typeof value === 'number' && value > 0 ? `${value} ${value === 1 ? one : many}` : null;

// One line of the history: what happened, and the details worth showing next to it.
export const describeEvent = (event: ResidentEvent): { title: string; detail?: string } => {
  const { details } = event;

  switch (event.kind) {
    case 'added':
      return { title: 'Lagt til' };
    case 'move_out_planned':
      return {
        title: `Utflytting planlagt til ${formatDeadline(String(details.date ?? ''), 'ukjent dato')}`,
      };
    case 'move_out_cancelled':
      return { title: 'Planlagt utflytting avbrutt' };
    case 'moved_out': {
      const parts = [
        count(details.shiftsReleased, 'vakt frigjort', 'vakter frigjort'),
        count(details.romslippSkipped, 'romslipp hoppet over', 'romslipp hoppet over'),
        typeof details.roleReset === 'string' ? `rollen ${details.roleReset} fjernet` : null,
      ].filter(Boolean);
      return { title: 'Flyttet ut', detail: parts.join(', ') || undefined };
    }
    case 'reactivated':
      return {
        title: 'Reaktivert',
        detail: details.loginRecreated ? 'Ny innlogging ble laget' : undefined,
      };
  }
};

// A move-out date has to be in the future: today is done with "Flytt ut nå".
export const earliestMoveOutDate = (now = new Date()): string => {
  const next = parseDateColumnValue(formatDateColumnValue(now));
  next.setDate(next.getDate() + 1);
  return formatDateColumnValue(next);
};
