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
