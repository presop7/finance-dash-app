import { useMemo } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { usage } from "../utils/categorySort";

// Last-used time and transaction count per category/fund id (see usage()).
export function useUsage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const lastUsed = useFinanceStore((s) => s.lastUsed);
  return useMemo(() => usage(transactions, lastUsed), [transactions, lastUsed]);
}
