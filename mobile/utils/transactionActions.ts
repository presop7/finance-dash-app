import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { confirmAsync, alertAsync } from "./confirm";

// Shared by TransactionDetailModal's own delete button and
// SwipeableTransactionRow's swipe-to-delete, so the two entry points can't
// drift apart — same confirm copy, same error handling.
export async function confirmAndDeleteTransaction(
  transaction: Transaction,
  fallbackLabel?: string,
): Promise<boolean> {
  const ok = await confirmAsync(
    "Delete Transaction",
    `Delete "${transaction.title || fallbackLabel || "this transaction"}"? This can't be undone.`,
  );
  if (!ok) return false;
  try {
    await useFinanceStore.getState().deleteTransaction(transaction.id);
    return true;
  } catch (err) {
    await alertAsync(
      "Couldn't delete transaction",
      err instanceof Error ? err.message : "Something went wrong.",
    );
    return false;
  }
}
