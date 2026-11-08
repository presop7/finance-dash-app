/// <reference types="jest" />
// Category ordering and the "can this transaction sync" check. Run: npm test
import { sortItems, txProblems, usage } from "./categorySort";

const cats = [
  { id: "a", label: "Zoo" },
  { id: "b", label: "Apple" },
  { id: "c", label: "Mango" },
];
const tx = (id: string, category: string, day: number) => ({
  id,
  category,
  fundCategory: "f1",
  date: new Date(2026, 0, day),
});
const now = new Date(2026, 5, 1).getTime();

test("orders by last used, A–Z, count and custom; ties keep custom order", () => {
  const u = usage([tx("1", "a", 1), tx("2", "a", 2), tx("3", "c", 5)], {}, now);
  const ids = (mode: Parameters<typeof sortItems>[1]) =>
    sortItems(cats, mode, ["b", "a", "c"], u, (c) => c.label).map((c) => c.id);
  expect(ids("custom")).toEqual(["b", "a", "c"]);
  expect(ids("lastUsed")).toEqual(["c", "a", "b"]);
  expect(ids("count")).toEqual(["a", "c", "b"]);
  expect(ids("alpha")).toEqual(["b", "c", "a"]);
});

test("a save stamped on this device beats older transaction dates", () => {
  const u = usage([tx("1", "c", 5)], { b: now }, now);
  expect(sortItems(cats, "lastUsed", [], u, (c) => c.label)[0].id).toBe("b");
});

test("future-dated and demo transactions don't jump the queue", () => {
  const u = usage([tx("1", "a", 1), { ...tx("2", "c", 1), date: new Date(2030, 0, 1) }, tx("demo-1", "b", 1)], { a: now - 1 }, now);
  expect(u.last.get("c")).toBe(now);
  expect(u.last.has("b")).toBe(false);
});

test("txProblems lists everything the backend would reject", () => {
  const known = { categories: [{ id: "c1" }], funds: [{ id: "f1" }], goals: [{ id: "g1" }] };
  const ok = { title: "Bread", amount: 2, category: "c1", fundCategory: "f1", date: new Date(), goalId: "g1" };
  expect(txProblems(ok, known)).toEqual([]);
  expect(
    txProblems({ title: " ", amount: 0, category: "", fundCategory: "gone", date: new Date("x"), goalId: "g2" }, known),
  ).toEqual(["title", "amount", "category", "fund", "date", "goal"]);
});
