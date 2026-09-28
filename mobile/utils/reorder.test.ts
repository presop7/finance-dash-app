/// <reference types="jest" />
// Drag-reorder slot math (Funds card). Run: npm test
import { moveToSlot, Slots } from "./reorder";

const order = (slots: Slots) => Object.keys(slots).sort((a, b) => slots[a] - slots[b]);

test("moving an item shifts the ones in between and keeps slots unique", () => {
  const start: Slots = { a: 0, b: 1, c: 2, d: 3 };
  expect(order(moveToSlot(start, "a", 2))).toEqual(["b", "c", "a", "d"]);
  expect(order(moveToSlot(start, "d", 0))).toEqual(["d", "a", "b", "c"]);
  expect(order(moveToSlot(start, "b", 1))).toEqual(["a", "b", "c", "d"]);
  // Step-by-step drag (how onUpdate calls it) lands the same as one jump.
  let slots = start;
  for (const to of [1, 2, 3]) slots = moveToSlot(slots, "a", to);
  expect(order(slots)).toEqual(["b", "c", "d", "a"]);
});
