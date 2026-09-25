import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Transaction } from "../store/useFinanceStore";
import { CategoryDetails } from "../components/TransactionList";
import { categoryChartColor } from "../utils/chartColors";

export type CategorySlice = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  amount: number;
  count: number;
  // 0-100, of the total passed in (i.e. of whichever type(s) are on screen).
  pct: number;
};

// Groups an already-filtered transaction list by category, summed and
// sorted biggest-first — shared by every Summary carousel chart (pie now,
// bar/"candle" next) so they can't drift out of sync with each other.
export function useCategoryBreakdown(
  filtered: Transaction[],
  detailsById: Map<string, CategoryDetails>,
): { slices: CategorySlice[]; total: number } {
  return useMemo(() => {
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const t of filtered) {
      const key = `${t.type}:${t.category}`;
      sums.set(key, (sums.get(key) ?? 0) + t.amount);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = Array.from(sums.values()).reduce((s, v) => s + v, 0);
    const fallback = detailsById.get("__fallback__");
    const slices: CategorySlice[] = Array.from(sums.entries())
      .map(([key, amount]) => {
        const details = detailsById.get(key) ?? fallback;
        // Charts use a generated warm/cool palette (see categoryChartColor)
        // rather than the category's own stored swatch — the key's
        // "expense:"/"income:" prefix is always present here since it comes
        // straight from a real transaction's type, never the fallback slot.
        const kind: "expense" | "income" = key.startsWith("expense:") ? "expense" : "income";
        return {
          key,
          label: details?.label || "Uncategorized",
          icon: (details?.icon ?? "ellipsis-horizontal-outline") as keyof typeof Ionicons.glyphMap,
          color: categoryChartColor(key, kind),
          amount,
          count: counts.get(key) ?? 0,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return { slices, total };
  }, [filtered, detailsById]);
}
