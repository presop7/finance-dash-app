import { memo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, ThemePreference } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { CURRENCIES } from "../constants/currencies";
import { DATE_FORMAT_PRESETS } from "../utils/formatDateTime";
import { nameFromEmail } from "../utils/greeting";
import { confirmAsync, confirmAsyncWithLabel, alertAsync } from "../utils/confirm";
import { financeApi } from "../services/financeApi";
import type { CategoryTabType } from "./modals/CategoriesModal";

type SettingsScreenProps = {
  onOpenCategories: (type: CategoryTabType) => void;
  onOpenImport: () => void;
};

function SettingsScreen({ onOpenCategories, onOpenImport }: SettingsScreenProps) {
  const {
    settings,
    updateSettings,
    pendingOps,
    transactions,
    isConnected,
    hydrate,
    themePreference,
    setThemePreference,
    displayNameOverride,
    setDisplayNameOverride,
  } = useFinanceStore();
  const { session, signOut } = useAuthStore();
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  const [clearingTransactions, setClearingTransactions] = useState(false);
  const [creatingTestCategories, setCreatingTestCategories] = useState(false);

  const handleSignOut = async () => {
    // Nothing is lost by signing out — the queue is kept in this account's own
    // cache slot — but it can't drain until they're back online and signed in,
    // so it's worth saying so rather than letting it silently sit there.
    if (pendingOps.length > 0) {
      const n = pendingOps.length;
      const proceed = await confirmAsyncWithLabel(
        "Unsynced changes",
        `You have ${n} change${n === 1 ? "" : "s"} that haven't synced yet. ${
          n === 1 ? "It's" : "They're"
        } saved on this device and won't be lost, but ${
          n === 1 ? "it" : "they"
        } won't finish syncing until you're back online and signed in. Sign out anyway?`,
        "Sign Out Anyway",
      );
      if (!proceed) return;
      await signOut();
      return;
    }

    const ok = await confirmAsync("Sign Out", "Are you sure you want to sign out?");
    if (!ok) return;
    await signOut();
  };

  const handleUpdateSettings = async (changes: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(changes);
    } catch (err) {
      await alertAsync(
        "Couldn't save setting",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  // Dev/testing convenience — wipes every transaction so a CSV import test
  // run doesn't mix in with earlier data. Requires being online for the
  // same reason CSV import does: this is a bulk operation and the offline
  // queue isn't built for deleting in bulk.
  const handleClearAllTransactions = async () => {
    if (!isConnected) {
      await alertAsync("You're offline", "Clearing transactions needs an internet connection.");
      return;
    }
    if (transactions.length === 0) {
      await alertAsync("Nothing to clear", "You don't have any transactions yet.");
      return;
    }

    const count = transactions.length;
    const proceed = await confirmAsyncWithLabel(
      "Clear All Transactions",
      `This will permanently delete all ${count} transaction${count === 1 ? "" : "s"}. This cannot be undone.`,
      "Delete All",
    );
    if (!proceed) return;

    setClearingTransactions(true);
    try {
      const results = await Promise.allSettled(
        transactions.map((t) => financeApi.deleteTransaction(t.id)),
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      await hydrate();
      if (failedCount > 0) {
        await alertAsync(
          "Some deletions failed",
          `${failedCount} transaction${failedCount === 1 ? "" : "s"} couldn't be deleted — try again.`,
        );
      }
    } finally {
      setClearingTransactions(false);
    }
  };

  // Dev/testing convenience — a one-tap way to get a batch of dummy
  // categories to exercise the multi-select bulk-delete flow with, instead
  // of creating 20 by hand one at a time.
  const handleCreateTestCategories = async () => {
    if (!isConnected) {
      await alertAsync("You're offline", "This needs an internet connection.");
      return;
    }
    const proceed = await confirmAsync(
      "Create Test Categories",
      "Create 20 dummy expense categories for testing?",
    );
    if (!proceed) return;

    setCreatingTestCategories(true);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          financeApi.createCategory({
            name: `Test Category ${i + 1}`,
            icon: "pricetag-outline",
            color: null,
            type: "expense",
          }),
        ),
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      await hydrate();
      if (failedCount > 0) {
        await alertAsync(
          "Some failed",
          `${failedCount} test categor${failedCount === 1 ? "y" : "ies"} couldn't be created.`,
        );
      }
    } finally {
      setCreatingTestCategories(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="contrast-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Theme</Text>
            </View>
            <View style={styles.segmented}>
              {(["light", "dark", "system"] as ThemePreference[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.segment, themePreference === option && styles.segmentActive]}
                  onPress={() => setThemePreference(option)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      themePreference === option && styles.segmentTextActive,
                    ]}
                  >
                    {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>General</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Display Name</Text>
              <Text style={styles.rowSubtitle}>Used for the dashboard greeting</Text>
            </View>
            <TextInput
              style={styles.nameInput}
              value={displayNameOverride ?? ""}
              onChangeText={(text) => setDisplayNameOverride(text.trim() ? text : null)}
              placeholder={nameFromEmail(session?.user.email) ?? "Name"}
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setCurrencyOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="cash-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Currency</Text>
              <Text style={styles.rowSubtitle}>{settings.currency}</Text>
            </View>
            <Ionicons
              name={currencyOpen ? "chevron-up" : "chevron-forward"}
              size={16}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {currencyOpen && (
            <View style={styles.dropdown}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.dropdownItem, c.code === settings.currency && styles.dropdownItemActive]}
                  onPress={() => {
                    handleUpdateSettings({ currency: c.code });
                    setCurrencyOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      c.code === settings.currency && styles.dropdownItemTextActive,
                    ]}
                  >
                    {c.code} — {c.label}
                  </Text>
                  {c.code === settings.currency && (
                    <Ionicons name="checkmark" size={14} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="eye-off-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Hide Balance</Text>
              <Text style={styles.rowSubtitle}>Fog the balance until held</Text>
            </View>
            <Switch
              value={settings.hideBalance}
              onValueChange={(v) => handleUpdateSettings({ hideBalance: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Time Format</Text>
            </View>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, settings.timeFormat === "12h" && styles.segmentActive]}
                onPress={() => handleUpdateSettings({ timeFormat: "12h" })}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.timeFormat === "12h" && styles.segmentTextActive,
                  ]}
                >
                  12h
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, settings.timeFormat === "24h" && styles.segmentActive]}
                onPress={() => handleUpdateSettings({ timeFormat: "24h" })}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.timeFormat === "24h" && styles.segmentTextActive,
                  ]}
                >
                  24h
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setDateFormatOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Date Format</Text>
              <Text style={styles.rowSubtitle}>{settings.dateFormat}</Text>
            </View>
            <Ionicons
              name={dateFormatOpen ? "chevron-up" : "chevron-forward"}
              size={16}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {dateFormatOpen && (
            <View style={styles.dropdown}>
              {DATE_FORMAT_PRESETS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.dropdownItem, f === settings.dateFormat && styles.dropdownItemActive]}
                  onPress={() => {
                    handleUpdateSettings({ dateFormat: f });
                    setDateFormatOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      f === settings.dateFormat && styles.dropdownItemTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                  {f === settings.dateFormat && (
                    <Ionicons name="checkmark" size={14} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>Categories & Storage</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onOpenCategories("expense")}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="pricetags-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Manage Categories</Text>
              <Text style={styles.rowSubtitle}>Expenses, income and funds</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={onOpenImport} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Import Transactions from CSV</Text>
              <Text style={styles.rowSubtitle}>Bring in history from another app</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>Danger Zone</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleClearAllTransactions}
            activeOpacity={0.7}
            disabled={clearingTransactions}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="trash-outline" size={18} color={Colors.expense} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: Colors.expense }]}>
                {clearingTransactions ? "Clearing…" : "Clear All Transactions"}
              </Text>
              <Text style={styles.rowSubtitle}>Permanently deletes every transaction</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleCreateTestCategories}
            activeOpacity={0.7}
            disabled={creatingTestCategories}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="flask-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>
                {creatingTestCategories ? "Creating…" : "Create 20 Test Categories"}
              </Text>
              <Text style={styles.rowSubtitle}>Dummy expense categories, for testing bulk delete</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Signed in as</Text>
              <Text style={styles.rowSubtitle}>{session?.user.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="log-out-outline" size={18} color={Colors.expense} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: Colors.expense }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Version</Text>
            </View>
            <Text style={styles.rowSubtitle}>1.0.0</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "600", color: Colors.textPrimary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    ...GlobalStyles.shadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  divider: { height: 0.5, backgroundColor: Colors.border, marginLeft: 58 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primary + "15",
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: "500", color: Colors.textPrimary },
  rowSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  nameInput: {
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: "right",
    minWidth: 100,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
  },
  segment: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  segmentTextActive: { color: "#fff" },
  dropdown: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: Colors.primary + "10" },
  dropdownItemText: { fontSize: 12, color: Colors.textSecondary },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: "600" },
  bottomPadding: { height: 20 },
  });
}

// Screens are memoized so opening a modal (which changes App-level state)
// doesn't re-render them — App passes only stable props (see AppContent).
export default memo(SettingsScreen);
