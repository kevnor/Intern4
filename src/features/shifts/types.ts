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
  // The holder wants someone else to take it, optionally for money.
  swapRequested: boolean;
  swapOfferAmount: number | null;
  swapNote: string | null;
};

// A shift that changed hands through a swap. Money is settled outside the app.
export type SwapLogEntry = {
  id: string;
  shiftStartsAt: Date;
  slotType: SlotType;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  amount: number | null;
  paid: boolean;
  createdAt: Date;
};

export type Unavailability = {
  id: string;
  userId: string;
  // Calendar days, inclusive.
  from: Date;
  to: Date;
  note: string | null;
};
