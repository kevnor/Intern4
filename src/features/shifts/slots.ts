import type { ShiftSlot, SlotType } from './types';

// Every shift is the same length, so hours are credited per shift rather than measured.
export const SHIFT_HOURS = 8;

type SlotDefinition = { type: SlotType; startHour: number; label: string; weekendOnly?: boolean };

// The 08-16 shift on weekdays is covered by a paid employee. 00-08 is shown as "24-08" because
// residents think of it as the end of the previous evening.
const SLOT_DEFINITIONS: SlotDefinition[] = [
  { type: 'natt', startHour: 0, label: '24–08' },
  { type: 'dag', startHour: 8, label: '08–16', weekendOnly: true },
  { type: 'kveld', startHour: 16, label: '16–24' },
];

export const SLOT_LABELS: Record<SlotType, string> = {
  natt: '24–08',
  dag: '08–16',
  kveld: '16–24',
};

export const SLOT_NAMES: Record<SlotType, string> = {
  natt: 'Natt',
  dag: 'Dag',
  kveld: 'Kveld',
};

export const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

export const getSlotTypesForDate = (date: Date): SlotType[] =>
  SLOT_DEFINITIONS.filter((slot) => !slot.weekendOnly || isWeekend(date)).map((slot) => slot.type);

// Slots for every day from `from` (inclusive) to `to` (exclusive), in chronological order.
export const generateSlots = (from: Date, to: Date): ShiftSlot[] => {
  const slots: ShiftSlot[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  while (day < to) {
    for (const definition of SLOT_DEFINITIONS) {
      if (definition.weekendOnly && !isWeekend(day)) continue;
      const startsAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        definition.startHour
      );
      const endsAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        definition.startHour + SHIFT_HOURS
      );
      slots.push({ startsAt, endsAt, slotType: definition.type });
    }
    day.setDate(day.getDate() + 1);
  }

  return slots;
};
