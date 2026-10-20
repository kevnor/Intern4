import { describe, expect, it } from 'vitest';
import { getSemester, getSemesterName, getSemesterStart, listSemesters } from './semester';

describe('semester', () => {
  it('starts the spring semester on 1 January', () => {
    expect(getSemesterStart(new Date(2026, 6, 31))).toEqual(new Date(2026, 0, 1));
    expect(getSemesterName(new Date(2026, 6, 31))).toBe('Vår 2026');
  });

  it('starts the autumn semester on 1 August', () => {
    expect(getSemesterStart(new Date(2026, 7, 1))).toEqual(new Date(2026, 7, 1));
    expect(getSemesterName(new Date(2026, 11, 31))).toBe('Høst 2026');
  });

  it('describes a semester with its key and end date', () => {
    expect(getSemester(new Date(2026, 9, 19))).toEqual({
      key: '2026-H',
      name: 'Høst 2026',
      start: new Date(2026, 7, 1),
      end: new Date(2027, 0, 1),
    });
    expect(getSemester(new Date(2026, 2, 1)).end).toEqual(new Date(2026, 7, 1));
  });

  it('lists semesters back to the earliest date, newest first', () => {
    expect(
      listSemesters(new Date(2025, 3, 10), new Date(2026, 9, 19)).map((semester) => semester.name)
    ).toEqual(['Høst 2026', 'Vår 2026', 'Høst 2025', 'Vår 2025']);
    expect(listSemesters(new Date(2027, 0, 1), new Date(2026, 9, 19))).toHaveLength(1);
  });
});
