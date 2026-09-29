import { memo, useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { GlobalStyles } from "../constants/styles";
import { useScreenTop } from "../hooks/useScreenTop";
import { useFinanceStore, ThemePreference } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { scrollIntoView, useTutorialStore, useTutorialTarget } from "../store/useTutorialStore";
import { CURRENCIES } from "../constants/currencies";
import { DATE_FORMAT_PRESETS } from "../utils/formatDateTime";
import { firstNameFromUser } from "../utils/greeting";
import { confirmAsyncWithLabel, alertAsync } from "../utils/confirm";
import { DEV_TOOLS } from "../constants/devTools";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";
import { generateDemoTransactions } from "../utils/demoTransactions";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { financeApi } from "../services/financeApi";
import FeedbackModal from "./modals/FeedbackModal";
import ShareAppModal from "./modals/ShareAppModal";
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
  const screenTop = useScreenTop();
  const styles = getThemedStyles(createStyles, Colors);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  const [clearingTransactions, setClearingTransactions] = useState(false);
  const [creatingTestCategories, setCreatingTestCategories] = useState(false);
  const [addingSamples, setAddingSamples] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const language = useFinanceStore((s) => s.language);
  const setLanguage = useFinanceStore((s) => s.setLanguage);
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const scrollTo = useCallback((view: View) => scrollIntoView(scrollRef, view), []);
  const generalRef = useTutorialTarget("settings:general", scrollTo);
  const categoriesRef = useTutorialTarget("settings:categories", scrollTo);
  const aboutRef = useTutorialTarget("settings:about", scrollTo);
  const startTutorial = useTutorialStore((s) => s.start);

  const handleSignOut = async () => {
    // Nothing is lost by signing out — the queue is kept in this account's own
    // cache slot — but it can't drain until they're back online and signed in,
    // so it's worth saying so rather than letting it silently sit there.
    if (pendingOps.length > 0) {
      const n = pendingOps.length;
      const proceed = await confirmAsyncWithLabel(
        t("settings.unsyncedTitle"),
        t("settings.unsyncedSignOut", { count: n }),
        t("settings.signOutAnyway"),
      );
      if (!proceed) return;
      await signOut();
      return;
    }

    const ok = await confirmAsyncWithLabel(t("settings.signOut"), t("settings.signOutConfirm"), t("settings.signOut"));
    if (!ok) return;
    await signOut();
  };

  const handleUpdateSettings = async (changes: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(changes);
    } catch (err) {
      await alertAsync(
        t("settings.saveFailed"),
        err instanceof Error ? err.message : t("common.somethingWrong"),
      );
    }
  };

  // Dev/testing convenience — wipes every transaction so a CSV import test
  // run doesn't mix in with earlier data. Requires being online for the
  // same reason CSV import does: this is a bulk operation and the offline
  // queue isn't built for deleting in bulk.
  const handleClearAllTransactions = async () => {
    if (!isConnected) {
      await alertAsync(t("common.offlineTitle"), t("settings.needsInternet"));
      return;
    }
    if (transactions.length === 0) {
      await alertAsync(t("settings.nothingToClear"), t("settings.noTransactionsYet"));
      return;
    }

    const count = transactions.length;
    const proceed = await confirmAsyncWithLabel(
      t("settings.clearAll"),
      t("settings.clearAllConfirm", { count }),
      t("settings.deleteAll"),
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
          t("settings.someDeletesFailed"),
          t("settings.deletesFailed", { count: failedCount }),
        );
      }
    } finally {
      setClearingTransactions(false);
    }
  };

  // For beta testers: fills an account with realistic data to try the
  // charts and filters with. Unlike the tour's samples these are saved to
  // the account for real, so they can be edited and deleted like any other.
  const handleAddSampleTransactions = async () => {
    if (!isConnected) {
      await alertAsync(t("common.offlineTitle"), t("settings.needsInternet"));
      return;
    }
    const proceed = await confirmAsyncWithLabel(
      t("settings.addSamples"),
      t("settings.addSamplesConfirm"),
      t("common.add"),
      { destructive: false },
    );
    if (!proceed) return;

    setAddingSamples(true);
    try {
      const { expenseCategories, incomeCategories, fundCategories } = useFinanceStore.getState();
      const funds = fundCategories.filter((f) => !f.locked);
      const samples = generateDemoTransactions(
        expenseCategories,
        incomeCategories,
        (funds.length > 0 ? funds : fundCategories).map((f) => f.id),
      );
      const result = await financeApi.bulkCreateTransactions(
        samples.map((t) => ({
          title: t.title,
          fund_category_id: t.fundCategory,
          category_id: t.category,
          amount: t.amount,
          currency: settings.currency,
          type: t.type,
          note: null,
          occurred_at: t.date.toISOString(),
          client_generated_id: Crypto.randomUUID(),
        })),
      );
      await hydrate();
      await alertAsync(
        t("settings.samplesAdded"),
        result.failed.length > 0
          ? t("settings.samplesPartly", { added: result.created.length, failed: result.failed.length })
          : t("settings.samplesAll", { count: result.created.length }),
      );
    } catch (err) {
      await alertAsync(
        t("settings.samplesFailed"),
        err instanceof Error ? err.message : t("common.somethingWrong"),
      );
    } finally {
      setAddingSamples(false);
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
    const proceed = await confirmAsyncWithLabel(
      "Create Test Categories",
      "Create 20 dummy expense categories for testing?",
      "Create",
      { destructive: false },
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
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, GlobalStyles.screenPadding, { paddingTop: screenTop }]}>
          <Text style={styles.headerTitle}>{t("nav.settings")}</Text>
        </View>

        <View ref={generalRef} collapsable={false}>
        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.appearance")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="contrast-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.theme")}</Text>
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
                    {t(`settings.theme_${option}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setLanguageOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="language-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.language")}</Text>
              <Text style={styles.rowSubtitle}>
                {language
                  ? (LANGUAGES.find((l) => l.code === language)?.name ?? language)
                  : t("settings.languageAuto")}
              </Text>
            </View>
            <Ionicons
              name={languageOpen ? "chevron-up" : "chevron-forward"}
              size={16}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {languageOpen && (
            <View style={styles.dropdown}>
              {[{ code: null as string | null, name: t("settings.languageAuto") }, ...LANGUAGES].map((l) => {
                const active = l.code === language;
                return (
                  <TouchableOpacity
                    key={l.code ?? "auto"}
                    style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => {
                      setLanguage(l.code);
                      setLanguageOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                      {l.name}
                    </Text>
                    {active && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.general")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.displayName")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.displayNameHint")}</Text>
            </View>
            <TextInput
              style={styles.nameInput}
              value={displayNameOverride ?? ""}
              onChangeText={(text) => setDisplayNameOverride(text.trim() ? text : null)}
              placeholder={firstNameFromUser(session?.user) ?? t("settings.name")}
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
              <Text style={styles.rowTitle}>{t("settings.currency")}</Text>
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
                    {c.code} — {t(`currencies.${c.code}`, { defaultValue: c.label })}
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
              <Text style={styles.rowTitle}>{t("settings.hideBalance")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.hideBalanceHint")}</Text>
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
              <Text style={styles.rowTitle}>{t("settings.timeFormat")}</Text>
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
              <Text style={styles.rowTitle}>{t("settings.dateFormat")}</Text>
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
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.categoriesStorage")}</Text>
        <View style={styles.card} ref={categoriesRef} collapsable={false}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onOpenCategories("expense")}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="pricetags-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.manageCategories")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.manageCategoriesHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={onOpenImport} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.importCsv")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.importCsvHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.dangerZone")}</Text>
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
                {clearingTransactions ? t("settings.clearing") : t("settings.clearAll")}
              </Text>
              <Text style={styles.rowSubtitle}>{t("settings.clearAllHint")}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleAddSampleTransactions}
            activeOpacity={0.7}
            disabled={addingSamples}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shuffle-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>
                {addingSamples ? t("settings.adding") : t("settings.addSamples")}
              </Text>
              <Text style={styles.rowSubtitle}>{t("settings.addSamplesHint")}</Text>
            </View>
          </TouchableOpacity>

          {DEV_TOOLS && (
            <>
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
                  <Text style={styles.rowSubtitle}>Dev only — dummy categories for testing bulk delete</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.account")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.signedInAs")}</Text>
              <Text style={styles.rowSubtitle}>{session?.user.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="log-out-outline" size={18} color={Colors.expense} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: Colors.expense }]}>{t("settings.signOut")}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>{t("settings.about")}</Text>
        <View style={styles.card} ref={aboutRef} collapsable={false}>
          <TouchableOpacity style={styles.row} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.shareApp")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.shareAppHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowFeedback(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.feedback")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.feedbackHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => startTutorial(true)} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <Ionicons name="school-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.replayTour")}</Text>
              <Text style={styles.rowSubtitle}>{t("settings.replayTourHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t("settings.version")}</Text>
            </View>
            <Text style={styles.rowSubtitle}>{Constants.expoConfig?.version ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
      <ShareAppModal visible={showShare} onClose={() => setShowShare(false)} />
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingBottom: 16 },
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
    fontSize: 16,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6,
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
