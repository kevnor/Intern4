export type SlotType = 'natt' | 'dag' | 'kveld';

export type ShiftStatus = 'draft' | 'published';

export type ShiftSlot = {
  startsAt: Date;
  endsAt: Date;
  slotType: SlotType;
};

export type Shift = ShiftSlot & {
  id: string;
  userId: string | null;
  userName: string | null;
  status: ShiftStatus;
};
