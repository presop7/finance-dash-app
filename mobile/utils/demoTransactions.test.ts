/// <reference types="jest" />
// Tour sample data rules. Run: npm test
import { generateDemoTransactions, isDemoId } from "./demoTransactions";

const expenseCats = [
  { id: "e1", label: "Food" },
  { id: "e2", label: "Transport" },
  { id: "e0", label: "Unassigned", locked: true },
];
const incomeCats = [{ id: "i1", label: "Salary" }];

test("40 transactions, 10% income, income total always above expenses", () => {
  for (let run = 0; run < 200; run++) {
    const now = new Date();
    const list = generateDemoTransactions(expenseCats, incomeCats, ["cash", "bank"], now);
    const incomes = list.filter((t) => t.type === "income");
    const expenses = list.filter((t) => t.type === "expense");
    const sum = (ts: typeof list) => ts.reduce((s, t) => s + t.amount, 0);

    expect(list).toHaveLength(40);
    expect(incomes).toHaveLength(4);
    expect(sum(incomes)).toBeGreaterThan(sum(expenses));
    expect(list.every((t) => t.amount > 0 && isDemoId(t.id))).toBe(true);
    expect(new Set(list.map((t) => t.id)).size).toBe(40);
    expect(list.some((t) => t.category === "e0")).toBe(false); // never the locked "Unassigned"
    expect(list.every((t) => t.date <= now)).toBe(true); // user's own entry stays on top
  }
});
