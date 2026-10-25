import { describe, expect, it } from 'vitest';
import { groupByRole, POSITION_ROLES } from './roles';
import type { BasicUserWithRole } from '../../shared/types/user';

const person = (
  name: string,
  role: string | undefined,
  overrides: Partial<BasicUserWithRole> = {}
): BasicUserWithRole => ({
  id: name,
  name,
  email: `${name.toLowerCase()}@example.test`,
  role,
  onLeave: false,
  isActive: true,
  ...overrides,
});

describe('groupByRole', () => {
  it('lists every position role in order, also when nobody holds it', () => {
    const groups = groupByRole([person('Kari', 'Romsjef')]);

    expect(groups.map((group) => group.role)).toEqual([...POSITION_ROLES]);
    expect(groups.find((group) => group.role === 'Vaktsjef')?.holders).toEqual([]);
    expect(groups.find((group) => group.role === 'Romsjef')?.holders.map((p) => p.name)).toEqual([
      'Kari',
    ]);
  });

  it('leaves out former residents and ordinary work-mode roles', () => {
    const groups = groupByRole([
      person('Gammel', 'Romsjef', { isActive: false }),
      person('Vanlig', 'Halv/Halv'),
      person('Ingen', undefined),
    ]);

    expect(groups.flatMap((group) => group.holders)).toEqual([]);
  });

  it('sorts holders by name, Norwegian letters last', () => {
    const groups = groupByRole([
      person('Åse', 'Data'),
      person('Zoe', 'Data'),
      person('Ola', 'Data'),
    ]);

    expect(groups.find((group) => group.role === 'Data')?.holders.map((p) => p.name)).toEqual([
      'Ola',
      'Zoe',
      'Åse',
    ]);
  });
});
