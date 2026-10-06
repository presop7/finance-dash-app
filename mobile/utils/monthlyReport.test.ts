/// <reference types="jest" />
// Monthly report numbers. Run: npm test
import { monthlyReport } from "./monthlyReport";
import type { Transaction } from "../store/useFinanceStore";

let n = 0;
const tx = (type: "income" | "expense", amount: number, category: string, month: number): Transaction => ({
  id: `t${++n}`,
  title: "",
  type,
  amount,
  category,
  fundCategory: "f",
  note: "",
  date: new Date(2026, month, 10),
});

test("a month against the one before", () => {
  const txs = [
    tx("income", 2000, "salary", 9),
    tx("expense", 300, "food", 9),
    tx("expense", 500, "rent", 9),
    tx("expense", 100, "food", 8),
    tx("expense", 500, "rent", 8),
    tx("expense", 80, "fun", 8),
  ];
  const r = monthlyReport(txs, 2026, 9);
  expect(r).toMatchObject({ income: 2000, expense: 800, net: 1200, count: 3 });
  expect(r.keptShare).toBeCloseTo(0.6);
  expect(r.topCategory?.id).toBe("rent");
  expect(r.biggestChanges.map((c) => [c.id, c.change])).toEqual([
    ["food", 200],
    ["fun", -80],
  ]);
});

test("January compares with December of the year before", () => {
  const r = monthlyReport([tx("expense", 50, "food", 11)], 2027, 0);
  expect(r.categories).toEqual([{ id: "food", now: 0, before: 50, change: -50 }]);
  expect(r.keptShare).toBeNull();
});
