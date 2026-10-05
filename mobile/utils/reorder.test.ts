/// <reference types="jest" />
// Drag-reorder order math. Run: npm test
import { dragStep, flowLayout, mergeOrder, moveTo, sortByOrder } from "./reorder";

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

const sizes = new Map([
  ["a", { width: 40, height: 30 }],
  ["b", { width: 120, height: 30 }],
  ["c", { width: 60, height: 30 }],
  ["d", { width: 60, height: 30 }],
]);

test("flowLayout wraps like a flex-wrap row", () => {
  const boxes = flowLayout(["a", "b", "c", "d"], sizes, { left: 16, top: 0, gap: 8, maxRight: 260 });
  expect(boxes.get("b")).toMatchObject({ x: 64, y: 0, line: 0 });
  expect(boxes.get("c")).toMatchObject({ x: 192, y: 0, line: 0 });
  expect(boxes.get("d")).toMatchObject({ x: 16, y: 38, line: 1 }); // 260 would be passed
});

test("dragStep moves both ways and never flips back between a narrow and a wide item", () => {
  const strip = (order: string[]) => flowLayout(order, sizes, { left: 0, top: 0, gap: 8, maxRight: Infinity });
  const start = ["a", "b", "c", "d"]; // a 0-40, b 48-168 (mid 108), c 176-236, d 244-304
  expect(dragStep(start, "a", { x: 70, y: 15 }, strip)).toEqual(start); // not past b's middle yet
  const moved = dragStep(start, "a", { x: 110, y: 15 }, strip);
  expect(moved).toEqual(["b", "a", "c", "d"]);
  expect(dragStep(moved, "a", { x: 110, y: 15 }, strip)).toEqual(moved); // stays put
  expect(dragStep(start, "a", { x: 290, y: 15 }, strip)).toEqual(["b", "c", "d", "a"]); // far right
  expect(dragStep(["b", "c", "d", "a"], "a", { x: 5, y: 15 }, strip)).toEqual(start); // and back
});

test("dragStep follows the finger to another line", () => {
  const grid = (order: string[]) => flowLayout(order, sizes, { left: 16, top: 0, gap: 8, maxRight: 260 });
  // d sits alone on line 1; dragging it up over a's right half puts it after a.
  expect(dragStep(["a", "b", "c", "d"], "d", { x: 50, y: 10 }, grid)).toEqual(["a", "d", "b", "c"]);
  // a dragged down to line 1, right of d's middle: last.
  expect(dragStep(["a", "b", "c", "d"], "a", { x: 100, y: 50 }, grid)).toEqual(["b", "c", "d", "a"]);
});
