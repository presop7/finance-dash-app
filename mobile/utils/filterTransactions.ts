import { Transaction } from "../store/useFinanceStore";
import { isWithinRange } from "./dateRanges";

export type DateRangePreset =
  | "thisMonth"
  | "lastMonth"
  | "3m"
  | "6m"
  | "thisYear"
  | "all"
  | "custom";

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  thisMonth: "This Month",
  lastMonth: "Last Month",
  "3m": "3 Months",
  "6m": "6 Months",
  thisYear: "This Year",
  all: "All Time",
  custom: "Custom",
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "thisMonth",
  "lastMonth",
  "3m",
  "6m",
  "thisYear",
  "all",
  "custom",
];

export type TransactionFilters = {
  dateRangePreset: DateRangePreset;
  customStart: Date | null;
  customEnd: Date | null;
  fundIds: string[];
  expenseCategoryIds: string[];
  incomeCategoryIds: string[];
};

export type MainTypeFilter = "expense" | "income" | "all";

export const DEFAULT_FILTERS: TransactionFilters = {
  dateRangePreset: "all",
  customStart: null,
  customEnd: null,
  fundIds: [],
  expenseCategoryIds: [],
  incomeCategoryIds: [],
};

export function getDateBounds(
  filters: TransactionFilters,
  now: Date = new Date(),
): { start: Date | null; end: Date } {
  switch (filters.dateRangePreset) {
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "lastMonth":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    case "3m":
      return { start: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), end: now };
    case "6m":
      return { start: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()), end: now };
    case "thisYear":
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case "custom":
      return { start: filters.customStart, end: filters.customEnd ?? now };
    case "all":
    default:
      return { start: null, end: now };
  }
}

export function applyFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
  mainType: MainTypeFilter,
  now: Date = new Date(),
): Transaction[] {
  const { start, end } = getDateBounds(filters, now);

  return transactions.filter((t) => {
    if (mainType !== "all" && t.type !== mainType) return false;
    if (!isWithinRange(new Date(t.date), start, end)) return false;
    if (filters.fundIds.length > 0 && !filters.fundIds.includes(t.fundCategory)) return false;
    if (t.type === "expense" && filters.expenseCategoryIds.length > 0 && !filters.expenseCategoryIds.includes(t.category)) {
      return false;
    }
    if (t.type === "income" && filters.incomeCategoryIds.length > 0 && !filters.incomeCategoryIds.includes(t.category)) {
      return false;
    }
    return true;
  });
}

export function countActiveFilters(filters: TransactionFilters): number {
  let count = 0;
  if (filters.dateRangePreset !== "all") count += 1;
  if (filters.fundIds.length > 0) count += 1;
  if (filters.expenseCategoryIds.length > 0) count += 1;
  if (filters.incomeCategoryIds.length > 0) count += 1;
  return count;
}
