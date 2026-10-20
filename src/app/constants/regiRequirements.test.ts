import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEMESTER_HOURS,
  getRequiredHoursForRole,
  getRequiredRegiHoursForRole,
} from './regiRequirements';

describe('getRequiredHoursForRole', () => {
  it('gives Full Regi all hours as regi', () => {
    expect(getRequiredHoursForRole('Full Regi', 40)).toEqual({ regi: 40, vakt: 0 });
  });

  it('gives Full Vakt all hours as vakt', () => {
    expect(getRequiredHoursForRole('Full Vakt', 40)).toEqual({ regi: 0, vakt: 40 });
  });

  it('splits Halv/Halv evenly', () => {
    expect(getRequiredHoursForRole('Halv/Halv', 40)).toEqual({ regi: 20, vakt: 20 });
  });

  it('requires nothing from Admin', () => {
    expect(getRequiredHoursForRole('Admin', 40)).toEqual({ regi: 0, vakt: 0 });
  });

  it('treats other and unknown roles as regi', () => {
    expect(getRequiredHoursForRole('Vaktsjef', 40)).toEqual({ regi: 40, vakt: 0 });
    expect(getRequiredHoursForRole(undefined, 40)).toEqual({ regi: 40, vakt: 0 });
  });

  it('falls back to the default total', () => {
    expect(getRequiredRegiHoursForRole('Full Regi')).toBe(DEFAULT_SEMESTER_HOURS);
  });
});
