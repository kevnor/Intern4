import { describe, expect, it } from 'vitest';
import { getSchedulableResidents, getTargetShifts } from './vaktTargets';
import type { BasicUserWithRole } from '../../shared/types/user';

const user = (id: string, role: string, overrides: Partial<BasicUserWithRole> = {}) => ({
  id,
  name: id,
  email: `${id}@example.com`,
  role,
  onLeave: false,
  isActive: true,
  ...overrides,
});

describe('getTargetShifts', () => {
  it('turns the vakt requirement into 8-hour shifts', () => {
    expect(getTargetShifts('Full Vakt', 48)).toBe(6);
    expect(getTargetShifts('Halv/Halv', 48)).toBe(3);
    expect(getTargetShifts('Full Regi', 48)).toBe(0);
  });

  it('rounds up so the requirement is always met', () => {
    expect(getTargetShifts('Halv/Halv', 40)).toBe(3);
  });
});

describe('getSchedulableResidents', () => {
  it('includes active Full Vakt and Halv/Halv residents who are not on leave', () => {
    const residents = getSchedulableResidents(
      [
        user('a', 'Full Vakt'),
        user('b', 'Halv/Halv'),
        user('c', 'Full Regi'),
        user('d', 'Full Vakt', { onLeave: true }),
        user('e', 'Halv/Halv', { isActive: false }),
        user('f', 'Admin'),
      ],
      48
    );

    expect(residents).toEqual([
      { id: 'a', targetShifts: 6 },
      { id: 'b', targetShifts: 3 },
    ]);
  });
});
