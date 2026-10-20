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
