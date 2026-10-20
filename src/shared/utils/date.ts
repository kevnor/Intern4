export type DateLike = Date | string | { seconds: number } | null | undefined;

const isTimestampLike = (value: unknown): value is { seconds: number } =>
  typeof value === 'object' &&
  value !== null &&
  'seconds' in value &&
  typeof value.seconds === 'number';

const toDate = (value: DateLike): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (isTimestampLike(value)) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const formatDate = (value: DateLike, fallback = '-'): string =>
  toDate(value)?.toLocaleDateString('no-NO') ?? fallback;

export const formatDateTime = (value: DateLike, fallback = '-'): string =>
  toDate(value)?.toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' }) ?? fallback;

export const APP_TIME_ZONE = 'Europe/Oslo';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Task deadlines are stored as calendar dates ('YYYY-MM-DD'), so they are shown as-is
// instead of being parsed as UTC midnight and shifted into the local time zone.
export const formatDeadline = (value: DateLike, fallback = 'Ingen frist'): string => {
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value);
    if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  }

  const date = toDate(value);
  return date ? date.toLocaleDateString('no-NO', { timeZone: APP_TIME_ZONE }) : fallback;
};

const dateColumnFormatter = new Intl.DateTimeFormat('en', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatDateColumnValue = (date: Date): string => {
  const parts = Object.fromEntries(
    dateColumnFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
};

// "2,5 t" – Norwegian decimal comma, at most two decimals.
export const formatHours = (hours: number): string =>
  `${hours.toLocaleString('no-NO', { maximumFractionDigits: 2 })} t`;
