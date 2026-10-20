import { describe, expect, it } from 'vitest';
import { canManageVakt } from './permissions';

describe('canManageVakt', () => {
  it('allows Admin and Vaktsjef', () => {
    expect(canManageVakt('Admin')).toBe(true);
    expect(canManageVakt('Vaktsjef')).toBe(true);
  });

  it('rejects other roles and missing roles', () => {
    expect(canManageVakt('Full Vakt')).toBe(false);
    expect(canManageVakt('Regisjef')).toBe(false);
    expect(canManageVakt(undefined)).toBe(false);
  });
});
