import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { CURRENCIES } from "../constants/currencies";
import { DATE_FORMAT_PRESETS } from "../utils/formatDateTime";
import { confirmAsync } from "../utils/confirm";
import type { CategoryTabType } from "./modals/CategoriesModal";

type SettingsScreenProps = {
  onOpenCategories: (type: CategoryTabType) => void;
};

export default function SettingsScreen({ onOpenCategories }: SettingsScreenProps) {
  const { settings, updateSettings } = useFinanceStore();
  const { session, signOut } = useAuthStore();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);

  const handleSignOut = async () => {
    const ok = await confirmAsync("Sign Out", "Are you sure you want to sign out?");
    if (!ok) return;
    await signOut();
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>General</Text>
        <View style={styles.card}>
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
                    updateSettings({ currency: c.code });
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
              onValueChange={(v) => updateSettings({ hideBalance: v })}
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
                onPress={() => updateSettings({ timeFormat: "12h" })}
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
                onPress={() => updateSettings({ timeFormat: "24h" })}
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
                    updateSettings({ dateFormat: f });
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

const styles = StyleSheet.create({
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
