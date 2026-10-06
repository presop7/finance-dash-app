/// <reference types="jest" />
// Savings goal math. Run: npm test
import { fundBalance, goalByFund, goalSaved, goalSpent, reservedByFund } from "./goals";
import type { Goal, Transaction } from "../store/useFinanceStore";

const tx = (type: "income" | "expense", amount: number, fundCategory: string, goalId?: string): Transaction => ({
  id: `${type}${amount}${fundCategory}${goalId ?? ""}`,
  title: "",
  type,
  amount,
  category: "c",
  fundCategory,
  note: "",
  date: new Date(2026, 9, 5),
  ...(goalId ? { goalId } : {}),
});
const alloc = (fundId: string, amount: number) => ({ id: `${fundId}${amount}`, fundId, amount, date: 0 });
const phone: Goal = {
  id: "phone",
  name: "Phone",
  target: 1000,
  icon: "flag-outline",
  color: null,
  allocations: [alloc("bank", 400), alloc("cash", 200), alloc("bank", 0.1), alloc("bank", -100.1)],
};

test("a goal's money: total and where it sits", () => {
  expect(goalSaved(phone)).toBe(500);
  expect(goalByFund(phone)).toEqual([
    { fundId: "bank", amount: 300 },
    { fundId: "cash", amount: 200 },
  ]);
});

test("setting aside moves no money; only the expense paid from the goal does", () => {
  const txs = [tx("income", 2000, "bank"), tx("expense", 50, "bank")];
  expect(fundBalance("bank", txs)).toBe(1950);
  expect(reservedByFund([phone], txs).get("bank")).toBe(300);
  expect(goalSpent(phone, txs)).toBeNull();

  const bought = [...txs, tx("expense", 950, "bank", "phone")];
  expect(goalSpent(phone, bought)).toMatchObject({ amount: 950 });
  expect(reservedByFund([phone], bought).size).toBe(0); // a used goal reserves nothing
  expect(fundBalance("bank", bought)).toBe(1000);
});
