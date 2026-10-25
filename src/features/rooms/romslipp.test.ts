import { describe, expect, it } from 'vitest';
import {
  canCloseRound,
  countMoves,
  describeAvailableRoom,
  describeOutcome,
  getAnsweredCount,
  getPeopleAhead,
  getTurn,
  isMyTurn,
} from './romslipp';
import type { RomslippParticipant } from './types';

const participant = (
  position: number,
  overrides: Partial<RomslippParticipant> = {}
): RomslippParticipant => ({
  userId: `u${position}`,
  userName: `Beboer ${position}`,
  position,
  status: 'waiting',
  fromRoomNumber: 100 + position,
  chosenRoomId: null,
  chosenRoomNumber: null,
  answeredAt: null,
  answeredByName: null,
  ...overrides,
});

describe('getTurn', () => {
  it('is the first resident in the order who has not answered', () => {
    const participants = [
      participant(3),
      participant(1, { status: 'stayed' }),
      participant(2),
      participant(4, { status: 'moved', chosenRoomNumber: 200, chosenRoomId: 'r' }),
    ];

    expect(getTurn(participants)?.userId).toBe('u2');
  });

  it('is nobody once everyone has answered', () => {
    expect(getTurn([participant(1, { status: 'stayed' })])).toBeUndefined();
    expect(getTurn([])).toBeUndefined();
  });
});

describe('progress', () => {
  const participants = [
    participant(1, { status: 'stayed' }),
    participant(2, { status: 'skipped' }),
    participant(3),
  ];

  it('counts answered residents, including those who were skipped', () => {
    expect(getAnsweredCount(participants)).toBe(2);
  });

  it('can only close when nobody is waiting', () => {
    expect(canCloseRound(participants)).toBe(false);
    expect(canCloseRound(participants.slice(0, 2))).toBe(true);
    expect(canCloseRound([])).toBe(false);
  });
});

describe('getPeopleAhead and isMyTurn', () => {
  const participants = [
    participant(1, { status: 'stayed' }),
    participant(2),
    participant(3),
    participant(4),
  ];

  it('counts those still waiting before the resident', () => {
    expect(getPeopleAhead(participants, 'u2')).toBe(0);
    expect(getPeopleAhead(participants, 'u4')).toBe(2);
  });

  it('is null for someone who has answered or does not take part', () => {
    expect(getPeopleAhead(participants, 'u1')).toBeNull();
    expect(getPeopleAhead(participants, 'someone-else')).toBeNull();
  });

  it('knows whose turn it is', () => {
    expect(isMyTurn(participants, 'u2')).toBe(true);
    expect(isMyTurn(participants, 'u3')).toBe(false);
  });
});

describe('describeOutcome', () => {
  it('says what each answer means', () => {
    expect(
      describeOutcome(participant(1, { status: 'moved', chosenRoomNumber: 273, chosenRoomId: 'r' }))
    ).toBe('Flytter fra 101 til 273');
    expect(describeOutcome(participant(2, { status: 'stayed' }))).toBe('Blir boende på 102');
    expect(describeOutcome(participant(3, { status: 'skipped' }))).toBe('Hoppet over, blir på 103');
    expect(describeOutcome(participant(4))).toBe('Venter');
  });
});

describe('describeAvailableRoom and countMoves', () => {
  it('describes a room with its type and spaces', () => {
    expect(describeAvailableRoom({ roomId: 'a', number: 273, type: null, freeSpots: 1 })).toBe(
      '273 · Ikke satt · 1 ledig plass'
    );
    expect(
      describeAvailableRoom({ roomId: 'b', number: 150, type: 'liten_parhybel', freeSpots: 2 })
    ).toBe('150 · Liten parhybel · 2 ledige plasser');
  });

  it('counts how many are moving', () => {
    expect(
      countMoves([
        participant(1, { status: 'moved', chosenRoomId: 'r', chosenRoomNumber: 200 }),
        participant(2, { status: 'stayed' }),
      ])
    ).toBe(1);
  });
});
