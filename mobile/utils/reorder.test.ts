/// <reference types="jest" />
// Drag-reorder order math. Run: npm test
import { mergeOrder, moveTo, sortByOrder } from "./reorder";

test("moveTo puts the item in the target's spot, shifting the rest", () => {
  const start = ["a", "b", "c", "d"];
  expect(moveTo(start, "a", "c")).toEqual(["b", "c", "a", "d"]);
  expect(moveTo(start, "d", "a")).toEqual(["d", "a", "b", "c"]);
  expect(moveTo(start, "b", "c")).toEqual(["a", "c", "b", "d"]);
  expect(moveTo(start, "c", "b")).toEqual(["a", "c", "b", "d"]);
});

test("sortByOrder follows the saved order; unknown items go last, in their order", () => {
  const items = ["a", "b", "c", "d"].map((id) => ({ id }));
  expect(sortByOrder(items, ["c", "a"]).map((i) => i.id)).toEqual(["c", "a", "b", "d"]);
});

test("mergeOrder keeps the other lists' ids", () => {
  expect(mergeOrder(["x", "a", "y", "b"], ["b", "a"])).toEqual(["b", "a", "x", "y"]);
});
