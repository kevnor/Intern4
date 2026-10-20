import { describe, expect, it } from 'vitest';
import { hasVakt, summarizeSemesterVakt } from './vaktSummary';

describe('summarizeSemesterVakt', () => {
  it('turns finished shifts into hours against the role’s vakt requirement', () => {
    expect(summarizeSemesterVakt(4, 'Full Vakt', 48)).toEqual({
      done: 32,
      required: 48,
      remaining: 16,
    });
    expect(summarizeSemesterVakt(1, 'Halv/Halv', 48)).toEqual({
      done: 8,
      required: 24,
      remaining: 16,
    });
  });

  it('never reports a negative remainder', () => {
    expect(summarizeSemesterVakt(10, 'Halv/Halv', 48).remaining).toBe(0);
  });

  it('has no requirement for regi-only roles but still shows voluntary vakt', () => {
    const none = summarizeSemesterVakt(0, 'Full Regi', 48);
    const voluntary = summarizeSemesterVakt(2, 'Full Regi', 48);

    expect(hasVakt(none)).toBe(false);
    expect(hasVakt(voluntary)).toBe(true);
    expect(voluntary).toEqual({ done: 16, required: 0, remaining: 0 });
  });
});
