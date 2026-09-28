// Example transactions shown during the app tour, so the charts and cards
// have something to show for a brand-new account. They only ever live in
// memory on the phone (never synced or saved) and are removed when the tour
// ends — see useFinanceStore's add/removeDemoTransactions.

export const DEMO_ID_PREFIX = "demo-";
export const isDemoId = (id: string) => id.startsWith(DEMO_ID_PREFIX);

type CategoryRef = { id: string; label: string };

type DemoTransaction = {
  id: string;
  title: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  fundCategory: string;
  note: string;
  date: Date;
};

const DEMO_COUNT = 40;
const INCOME_COUNT = DEMO_COUNT / 10; // 10% income, 90% expenses
const DAYS_BACK = 60;

// Friendly titles for the default categories; anything else uses its label.
const TITLES: Record<string, string[]> = {
  Food: ["Groceries", "Supermarket", "Bakery", "Fruit and veg"],
  Restaurant: ["Lunch", "Coffee", "Dinner out", "Pizza"],
  Transport: ["Fuel", "Bus ticket", "Taxi", "Parking"],
  Entertainment: ["Cinema", "Concert", "Streaming", "Books"],
  Other: ["Pharmacy", "Gift", "Haircut", "Phone bill"],
  Salary: ["Monthly salary"],
  Freelance: ["Freelance project"],
  Investment: ["Dividends"],
};

const between = (min: number, max: number, random: () => number) =>
  Math.round((min + random() * (max - min)) * 100) / 100;

const pick = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)];

export function generateDemoTransactions(
  expenseCategories: CategoryRef[],
  incomeCategories: CategoryRef[],
  fundIds: string[],
  now: Date = new Date(),
  random: () => number = Math.random,
): DemoTransaction[] {
  // "Unassigned" is a fallback bucket, not something to showcase.
  const usable = (list: CategoryRef[]) => {
    const real = list.filter((c) => c.label !== "Unassigned");
    return real.length > 0 ? real : list;
  };
  const expenseCats = usable(expenseCategories);
  const incomeCats = usable(incomeCategories);
  const fund = (i: number) => fundIds[i % fundIds.length] ?? "";

  const make = (i: number, type: "expense" | "income", amount: number): DemoTransaction => {
    const category = pick(type === "expense" ? expenseCats : incomeCats, random);
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(random() * DAYS_BACK));
    date.setHours(8 + Math.floor(random() * 13), Math.floor(random() * 60), 0, 0);
    // Never later than now — the user's own first transaction must land on
    // top of the Recent list, as the tour tells them.
    if (date > now) date.setDate(date.getDate() - 1);
    return {
      id: `${DEMO_ID_PREFIX}${i}`,
      title: pick(TITLES[category?.label] ?? [category?.label ?? "Example"], random),
      type,
      amount,
      category: category?.id ?? "",
      fundCategory: fund(i),
      note: "",
      date,
    };
  };

  const expenses = Array.from({ length: DEMO_COUNT - INCOME_COUNT }, (_, i) =>
    make(i, "expense", between(4, 120, random)),
  );
  const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Income always outweighs spending: draw random shares, then size them so
  // the income total lands 20-50% above the expense total.
  const shares = Array.from({ length: INCOME_COUNT }, () => 0.5 + random());
  const shareTotal = shares.reduce((a, b) => a + b, 0);
  const incomeTarget = expenseTotal * between(1.2, 1.5, random);
  const incomes = shares.map((share, i) =>
    make(DEMO_COUNT - INCOME_COUNT + i, "income", Math.ceil((incomeTarget * share) / shareTotal)),
  );

  return [...expenses, ...incomes].sort((a, b) => b.date.getTime() - a.date.getTime());
}
