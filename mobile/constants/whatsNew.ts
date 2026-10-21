import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

// The "What's new" sheet: shown once per device after an update to this
// version (and from Settings → About). For the next update: change the
// version (same as app.config.js), the items, and their texts under
// whatsNew.items in every language.
export const WHATS_NEW_VERSION = "1.1.1";
// What "seen" is recorded as. Bump the suffix (e.g. "-3") to show the sheet
// again to devices that already saw it, when items are added without a new
// version; on a new version make it just the version.
export const WHATS_NEW_SEEN_KEY = WHATS_NEW_VERSION + "-2";

type Item = { key: string; icon: ComponentProps<typeof Ionicons>["name"] };

export const WHATS_NEW: { new: Item[]; fixes: Item[] } = {
  new: [
    { key: "freeToSpend", icon: "wallet-outline" },
    { key: "search", icon: "search-outline" },
    { key: "report", icon: "document-text-outline" },
    { key: "reorder", icon: "swap-vertical-outline" },
    { key: "progress", icon: "stats-chart-outline" },
    { key: "newFirst", icon: "sparkles-outline" },
  ],
  fixes: [
    { key: "instant", icon: "flash-outline" },
    { key: "sync", icon: "sync-outline" },
    { key: "online", icon: "wifi-outline" },
    { key: "reminders", icon: "notifications-outline" },
  ],
};
