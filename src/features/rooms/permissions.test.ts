import { describe, expect, it } from 'vitest';
import { canManageRooms } from './permissions';

describe('canManageRooms', () => {
  it('allows Admin, Romsjef and Data', () => {
    expect(canManageRooms('Admin')).toBe(true);
    expect(canManageRooms('Romsjef')).toBe(true);
    expect(canManageRooms('Data')).toBe(true);
  });

  it('rejects everyone else', () => {
    expect(canManageRooms('Regisjef')).toBe(false);
    expect(canManageRooms('Halv/Halv')).toBe(false);
    expect(canManageRooms(undefined)).toBe(false);
  });
});
