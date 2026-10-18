import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

// The "What's new" sheet: shown once per device after an update to this
// version (and from Settings → About). For the next update: change the
// version (same as app.config.js), the items, and their texts under
// whatsNew.items in every language.
export const WHATS_NEW_VERSION = "1.1.1";

type Item = { key: string; icon: ComponentProps<typeof Ionicons>["name"] };

export const WHATS_NEW: { new: Item[]; fixes: Item[] } = {
  new: [
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
