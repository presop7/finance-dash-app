import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { confirmAsync, alertAsync } from "./confirm";
import i18n from "../i18n";

// Shared by TransactionDetailModal's own delete button and
// SwipeableTransactionRow's swipe-to-delete, so the two entry points can't
// drift apart — same confirm copy, same error handling.
export async function confirmAndDeleteTransaction(
  transaction: Transaction,
  fallbackLabel?: string,
): Promise<boolean> {
  const ok = await confirmAsync(
    i18n.t("transaction.deleteTitle"),
    i18n.t("transaction.deleteConfirm", { title: transaction.title || fallbackLabel || i18n.t("transaction.thisOne") }),
  );
  if (!ok) return false;
  try {
    await useFinanceStore.getState().deleteTransaction(transaction.id);
    return true;
  } catch (err) {
    await alertAsync(
      i18n.t("transaction.deleteFailed"),
      err instanceof Error ? err.message : i18n.t("common.somethingWrong"),
    );
    return false;
  }
}
