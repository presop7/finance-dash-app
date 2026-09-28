export type Slots = Record<string, number>;

// Moves `id` to slot `to`, shifting the items in between by one. A worklet so
// drag handlers can call it on the UI thread every frame.
export function moveToSlot(slots: Slots, id: string, to: number): Slots {
  "worklet";
  const from = slots[id];
  if (from === to) return slots;
  const next: Slots = {};
  for (const key in slots) {
    const slot = slots[key];
    if (key === id) next[key] = to;
    else if (from < to && slot > from && slot <= to) next[key] = slot - 1;
    else if (from > to && slot < from && slot >= to) next[key] = slot + 1;
    else next[key] = slot;
  }
  return next;
}
