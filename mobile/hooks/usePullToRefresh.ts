import { useCallback, useState } from "react";
import { useFinanceStore } from "../store/useFinanceStore";

// Pull-to-refresh for the transaction screens: re-sends anything still queued
// (including failed writes) and re-downloads everything from the server.
// Tracks its own spinner rather than the store's "refreshing" status, so
// background syncs don't make the spinner pop up on their own.
export function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useFinanceStore.getState().hydrate();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
