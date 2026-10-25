import { describe, expect, it } from 'vitest';
import {
  describeEvent,
  describeOffboarding,
  earliestMoveOutDate,
  type OffboardingPreview,
  type ResidentEvent,
} from './offboarding';

const nothing: OffboardingPreview = {
  roomNumber: null,
  futureShifts: 0,
  openSwaps: 0,
  waitingRomslipp: 0,
  openReports: 0,
  roleReset: null,
};

const event = (
  kind: ResidentEvent['kind'],
  details: Record<string, unknown> = {}
): ResidentEvent => ({
  id: 'e',
  kind,
  actorName: null,
  reason: null,
  details,
  createdAt: new Date(2025, 7, 1),
});

describe('describeOffboarding', () => {
  it('always says the login is blocked, and nothing else when there is nothing else', () => {
    expect(describeOffboarding(nothing)).toEqual([
      'Innloggingen sperres, med Microsoft og passord.',
    ]);
  });

  it('lists only what applies', () => {
    expect(
      describeOffboarding({
        roomNumber: 214,
        futureShifts: 3,
        openSwaps: 1,
        waitingRomslipp: 1,
        openReports: 2,
        roleReset: 'Vaktsjef',
      })
    ).toEqual([
      'Rom 214 blir ledig.',
      '3 vakter frem i tid blir ledige (1 lå ute for bytte), og Vaktsjef må fylle dem.',
      'Hoppes over i romslippet som pågår.',
      'Rollen Vaktsjef settes tilbake til Halv/Halv.',
      '2 åpne romrapporter blir liggende.',
      'Innloggingen sperres, med Microsoft og passord.',
    ]);
  });

  it('uses the singular for one shift and one report', () => {
    const lines = describeOffboarding({ ...nothing, futureShifts: 1, openReports: 1 });

    expect(lines).toContain('1 vakt frem i tid blir ledig, og Vaktsjef må fylle den.');
    expect(lines).toContain('1 åpen romrapport blir liggende.');
  });
});

describe('describeEvent', () => {
  it('describes each kind of event', () => {
    expect(describeEvent(event('added'))).toEqual({ title: 'Lagt til' });
    expect(describeEvent(event('move_out_planned', { date: '2099-06-30' }))).toEqual({
      title: 'Utflytting planlagt til 30.06.2099',
    });
    expect(describeEvent(event('move_out_cancelled'))).toEqual({
      title: 'Planlagt utflytting avbrutt',
    });
    expect(describeEvent(event('reactivated', { loginRecreated: true }))).toEqual({
      title: 'Reaktivert',
      detail: 'Ny innlogging ble laget',
    });
  });

  it('summarises what a move-out did', () => {
    expect(
      describeEvent(
        event('moved_out', { shiftsReleased: 2, romslippSkipped: 1, roleReset: 'Vaktsjef' })
      )
    ).toEqual({
      title: 'Flyttet ut',
      detail: '2 vakter frigjort, 1 romslipp hoppet over, rollen Vaktsjef fjernet',
    });
    expect(
      describeEvent(event('moved_out', { shiftsReleased: 0, romslippSkipped: 0, roleReset: null }))
    ).toEqual({ title: 'Flyttet ut', detail: undefined });
  });
});

describe('earliestMoveOutDate', () => {
  it('is tomorrow by the Oslo calendar', () => {
    // 23:30 UTC on 30 June is already 1 July in Oslo, so the earliest day is 2 July.
    expect(earliestMoveOutDate(new Date('2099-06-30T23:30:00Z'))).toBe('2099-07-02');
    expect(earliestMoveOutDate(new Date('2099-06-30T10:00:00Z'))).toBe('2099-07-01');
  });
});
