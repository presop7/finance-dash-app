/// <reference types="jest" />
// Alert rules: what notifies (once) and what's active (for tips). Run: npm test
import { activeAlerts, evaluateAlerts } from "./alertEvaluation";
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
