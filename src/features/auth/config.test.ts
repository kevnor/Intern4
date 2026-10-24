import { describe, expect, it } from 'vitest';
import { isLocalLoginEnabled } from './config';

describe('isLocalLoginEnabled', () => {
  it('is on unless it is explicitly switched off', () => {
    expect(isLocalLoginEnabled(undefined)).toBe(true);
    expect(isLocalLoginEnabled('')).toBe(true);
    expect(isLocalLoginEnabled('true')).toBe(true);
    expect(isLocalLoginEnabled('anything')).toBe(true);
  });

  it('can be switched off', () => {
    expect(isLocalLoginEnabled('false')).toBe(false);
    expect(isLocalLoginEnabled(' FALSE ')).toBe(false);
    expect(isLocalLoginEnabled('0')).toBe(false);
  });
});
