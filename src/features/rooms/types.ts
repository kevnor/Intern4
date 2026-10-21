export type RoomType =
  | 'bottekott'
  | 'korrhybel'
  | 'liten_parhybel'
  | 'stor_parhybel'
  | 'husfarhybel';

export type RoomOccupant = {
  userId: string;
  userName: string;
  movedIn: Date;
};

export type Room = {
  id: string;
  number: number;
  // Not known for every room yet.
  type: RoomType | null;
  capacity: number;
  occupants: RoomOccupant[];
};

// One stay in a room. A resident has at most one stay without movedOut.
export type Occupancy = {
  id: string;
  roomId: string;
  roomNumber: number;
  userId: string;
  userName: string;
  movedIn: Date;
  movedOut: Date | null;
};

// An active resident as the room administration sees them.
export type ResidentForRoom = {
  id: string;
  name: string;
  // 0 when the resident has no room.
  roomNumber: number;
  isHusfar: boolean;
};

export type RoomReportStatus = 'open' | 'task_created' | 'resolved' | 'dismissed';

export type RoomReport = {
  id: string;
  roomId: string;
  roomNumber: number;
  reportedBy: string;
  reporterName: string;
  title: string;
  description: string | null;
  status: RoomReportStatus;
  // The regi task made from the report, once there is one.
  workItemId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

// Regi work done on a room. Pending work still needs Regisjef's confirmation.
export type RoomWork = {
  id: string;
  title: string;
  isTask: boolean;
  hours: number;
  performedAt: Date;
  userName: string;
  approved: boolean;
};

export type RomslippStatus = 'open' | 'closed' | 'cancelled';

export type ParticipantStatus = 'waiting' | 'moved' | 'stayed' | 'skipped';

export type RomslippRound = {
  id: string;
  semesterKey: string;
  status: RomslippStatus;
  createdAt: Date;
  closedAt: Date | null;
};

// One resident in a round. Position is the order they are asked in.
export type RomslippParticipant = {
  userId: string;
  userName: string;
  position: number;
  status: ParticipantStatus;
  fromRoomNumber: number | null;
  chosenRoomId: string | null;
  chosenRoomNumber: number | null;
  answeredAt: Date | null;
  answeredByName: string | null;
};

export type RomslippState = {
  round: RomslippRound;
  participants: RomslippParticipant[];
};

// A room with space in the round as it stands now.
export type AvailableRoom = {
  roomId: string;
  number: number;
  type: RoomType | null;
  freeSpots: number;
};
