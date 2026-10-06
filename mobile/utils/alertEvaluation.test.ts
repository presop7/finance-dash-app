/// <reference types="jest" />
// Alert rules: what notifies (once) and what's active (for tips). Run: npm test
import { activeAlerts, evaluateAlerts, trackerProgress } from "./alertEvaluation";
import type { AlertRule, Transaction } from "../store/useFinanceStore";

const tx = (type: "income" | "expense", amount: number, date = new Date(2026, 9, 5)): Transaction => ({
  id: `${type}${amount}`,
  title: "",
  type,
  amount,
  category: "c",
  fundCategory: "",
  note: "",
  date,
});
const now = new Date(2026, 9, 10);
const low: AlertRule = { id: "low", type: "lowBalance", amount: 500, enabled: true };
const month: AlertRule = { id: "m", type: "monthlyExpenseOver", amount: 100, enabled: true };

test("low balance notifies once on crossing, and records going back up", () => {
  const poor = [tx("income", 300)];
  const [hit] = evaluateAlerts([low], poor, [], [], now);
  expect(hit).toMatchObject({ notify: true, newKey: "below" });
  expect(evaluateAlerts([{ ...low, lastTriggeredKey: "below" }], poor, [], [], now)).toEqual([]);
  const [back] = evaluateAlerts([{ ...low, lastTriggeredKey: "below" }], [tx("income", 900)], [], [], now);
  expect(back).toMatchObject({ notify: false, newKey: "above" });
});

test("month limit notifies once a month, never when under", () => {
  expect(evaluateAlerts([month], [tx("expense", 50)], [], [], now)).toEqual([]);
  const [hit] = evaluateAlerts([month], [tx("expense", 150)], [], [], now);
  expect(hit).toMatchObject({ notify: true, newKey: "2026-10" });
  expect(evaluateAlerts([{ ...month, lastTriggeredKey: "2026-10" }], [tx("expense", 150)], [], [], now)).toEqual([]);
});

test("activeAlerts lists what's in alarm now, even if already told", () => {
  const rules = [{ ...low, lastTriggeredKey: "below" }, { ...month, lastTriggeredKey: "2026-10" }, { ...month, id: "off", enabled: false }];
  const ids = activeAlerts(rules, [tx("income", 300), tx("expense", 150)], [], [], now).map((a) => a.id);
  expect(ids).toEqual(["low", "m"]);
});

test("trackers count their own category; savings can count all income since they started", () => {
  const cat = (type: "income" | "expense", amount: number, category: string, date = new Date(2026, 9, 5)) => ({
    ...tx(type, amount, date),
    id: `${type}${amount}${category}`,
    category,
  });
  const txs = [cat("expense", 200, "loan"), cat("expense", 50, "food"), cat("income", 300, "lend"), cat("income", 900, "salary", new Date(2026, 8, 1))];
  const loan: AlertRule = { id: "l", type: "loanTracker", amount: 1000, enabled: true, categoryId: "loan" };
  expect(trackerProgress(loan, txs)).toBe(200);
  expect(trackerProgress({ ...loan, type: "lendTracker", categoryId: "lend" }, txs)).toBe(300);
  const savings: AlertRule = { id: "s", type: "savingsTracker", amount: 500, enabled: true, allIncome: true, startAt: new Date(2026, 9, 1).getTime() };
  expect(trackerProgress(savings, txs)).toBe(300); // the September salary is before it started
  const [done] = evaluateAlerts([{ ...loan, amount: 200 }], txs, [], [], now);
  expect(done).toMatchObject({ notify: true, newKey: "done" });
  expect(evaluateAlerts([{ ...loan, amount: 200, lastTriggeredKey: "done" }], txs, [], [], now)).toEqual([]);
});
