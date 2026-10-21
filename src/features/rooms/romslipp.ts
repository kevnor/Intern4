import type { AvailableRoom, ParticipantStatus, RomslippParticipant } from './types';
import { formatRoomType } from './rooms';

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  waiting: 'Venter',
  moved: 'Flytter',
  stayed: 'Blir boende',
  skipped: 'Hoppet over',
};

const byPosition = (a: RomslippParticipant, b: RomslippParticipant) => a.position - b.position;

// Whose turn it is: the first one in the order who has not answered.
export const getTurn = (participants: RomslippParticipant[]): RomslippParticipant | undefined =>
  [...participants].sort(byPosition).find((participant) => participant.status === 'waiting');

export const getAnsweredCount = (participants: RomslippParticipant[]): number =>
  participants.filter((participant) => participant.status !== 'waiting').length;

// Everyone has answered (or been skipped), so Romsjef can close the round.
export const canCloseRound = (participants: RomslippParticipant[]): boolean =>
  participants.length > 0 && getTurn(participants) === undefined;

// How many people are asked before this resident. Zero when it is their turn, null when they do
// not take part or have already answered.
export const getPeopleAhead = (
  participants: RomslippParticipant[],
  userId: string
): number | null => {
  const me = participants.find((participant) => participant.userId === userId);
  if (!me || me.status !== 'waiting') return null;
  return participants.filter(
    (participant) => participant.status === 'waiting' && participant.position < me.position
  ).length;
};

export const isMyTurn = (participants: RomslippParticipant[], userId: string): boolean =>
  getTurn(participants)?.userId === userId;

// "Flytter til 273", "Blir boende på 150" ...
export const describeOutcome = (participant: RomslippParticipant): string => {
  switch (participant.status) {
    case 'moved':
      return `Flytter fra ${participant.fromRoomNumber ?? '?'} til ${participant.chosenRoomNumber ?? '?'}`;
    case 'stayed':
      return `Blir boende på ${participant.fromRoomNumber ?? '?'}`;
    case 'skipped':
      return `Hoppet over, blir på ${participant.fromRoomNumber ?? '?'}`;
    default:
      return 'Venter';
  }
};

export const describeAvailableRoom = (room: AvailableRoom): string =>
  `${room.number} · ${formatRoomType(room.type)} · ${room.freeSpots === 1 ? '1 ledig plass' : `${room.freeSpots} ledige plasser`}`;

export const countMoves = (participants: RomslippParticipant[]): number =>
  participants.filter((participant) => participant.status === 'moved').length;
