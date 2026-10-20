import { describe, expect, it } from 'vitest';
import { formatDateColumnValue, formatDeadline } from './date';

describe('date utils', () => {
  it('formats date-only values in the app timezone', () => {
    expect(formatDateColumnValue(new Date('2026-04-20T22:30:00.000Z'))).toBe('2026-04-21');
  });

  it('formats date-only deadlines without shifting the day', () => {
    expect(formatDeadline('2026-10-29')).toBe('29.10.2026');
    expect(formatDeadline('2026-10-28T23:30:00.000Z')).toBe('29.10.2026');
    expect(formatDeadline(null)).toBe('Ingen frist');
  });
});
