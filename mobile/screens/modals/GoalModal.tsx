import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "../../components/AppModal";
import ModalCloseButton from "../../components/ModalCloseButton";
import FieldIcon from "../../components/FieldIcon";
import { ColorsType } from "../../constants/colors";
import { FIELD_BOX, FIELD_INPUT } from "../../constants/styles";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { FONT } from "../../constants/typography";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore, Goal } from "../../store/useFinanceStore";
import { formatCurrency } from "../../utils/currency";
import { alertAsync, confirmAsync } from "../../utils/confirm";
import { fundBalance, goalByFund, goalSaved, goalSpent, reservedByFund } from "../../utils/goals";
import { isDemoId } from "../../utils/demoTransactions";
import { currentLocale } from "../../i18n";
import { useTranslation } from "react-i18next";

// A savings goal's sheet. Opened on a goal: its progress, where its money
// sits, "Задели" (set money aside from a fund) and "Освободи" (release it
// back), and its history. Opened with no goal: the form to create one.
// Setting aside moves no money — it only marks part of a fund as reserved.
type View_ = "details" | "form" | "setAside" | "release";

const AMOUNT_CLEAN = /[^0-9.]/g;

export default function GoalModal({
  visible,
  goal,
  onClose,
}: {
  visible: boolean;
  goal: Goal | null; // null: create a new goal
  onClose: () => void;
}) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const insets = useSafeAreaInsets();
  const { fundCategories, transactions, goals, settings, addGoal, updateGoal, deleteGoal, addGoalAllocation, deleteGoalAllocation } =
    useFinanceStore();
  // The sheet follows the store's copy, so it updates right after a change.
  const current = goal ? goals.find((g) => g.id === goal.id) ?? goal : null;

  const [view, setView] = useState<View_>("details");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [fundId, setFundId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setView(goal ? "details" : "form");
    setName(goal?.name ?? "");
    setTarget(goal ? String(goal.target) : "");
    setAmount("");
    setFundId(null);
  }, [visible, goal]);

  const money = (n: number) => formatCurrency(n, settings.currency);
  const realTransactions = transactions.filter((tx) => !isDemoId(tx.id));
  const funds = fundCategories.filter((f) => !f.locked);
  const fundName = (id: string) => fundCategories.find((f) => f.id === id)?.name ?? "—";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      await alertAsync(t("goals.saveFailedTitle"), t("goals.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ---- create / edit ----
  const targetValue = parseFloat(target);
  const canSaveForm = name.trim().length > 0 && targetValue > 0 && !busy;
  const saveForm = () =>
    run(async () => {
      const fields = { name: name.trim(), target: targetValue, icon: current?.icon ?? "flag-outline" };
      if (current) {
        await updateGoal(current.id, fields);
        setView("details");
      } else {
        await addGoal(fields);
        onClose();
      }
    });

  const removeGoal = async () => {
    if (!current) return;
    const ok = await confirmAsync(t("goals.deleteTitle"), t("goals.deleteConfirm", { name: current.name }));
    if (!ok) return;
    await run(async () => {
      await deleteGoal(current.id);
      onClose();
    });
  };

  // ---- set aside / release ----
  const amountValue = parseFloat(amount);
  const held = current ? goalByFund(current) : [];
  const heldIn = (id: string | null) => held.find((h) => h.fundId === id)?.amount ?? 0;
  const freeIn = (id: string) =>
    fundBalance(id, realTransactions) - (reservedByFund(goals, realTransactions).get(id) ?? 0);
  const releaseTooMuch = view === "release" && amountValue > heldIn(fundId);
  const canAllocate = amountValue > 0 && Boolean(fundId) && !busy && !releaseTooMuch;
  const saveAllocation = () =>
    run(async () => {
      if (!current || !fundId) return;
      await addGoalAllocation(current.id, fundId, view === "release" ? -amountValue : amountValue);
      setAmount("");
      setFundId(null);
      setView("details");
    });

  const openAllocate = (mode: "setAside" | "release") => {
    setAmount("");
    // Releasing: start from the fund that holds the most of it, in full.
    if (mode === "release" && held[0]) {
      setFundId(held[0].fundId);
      setAmount(String(held[0].amount));
    } else {
      setFundId(null);
    }
    setView(mode);
  };

  const removeAllocation = async (allocationId: string) => {
    if (!current) return;
    const ok = await confirmAsync(t("goals.removeEntryTitle"), t("goals.removeEntry"));
    if (!ok) return;
    await run(() => deleteGoalAllocation(current.id, allocationId));
  };

  // ---- render ----
  const title =
    view === "form" ? (current ? t("goals.edit") : t("goals.new")) : view === "setAside" ? t("goals.setAside") : view === "release" ? t("goals.release") : current?.name ?? "";

  const amountField = (
    <View style={styles.fieldContainer}>
      <FieldIcon name="cash-outline" />
      <TextInput
        style={styles.fieldInput}
        placeholder="0.00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
        value={view === "form" ? target : amount}
        onChangeText={(v) => (view === "form" ? setTarget : setAmount)(v.replace(AMOUNT_CLEAN, ""))}
      />
      <Text style={styles.suffix}>{settings.currency}</Text>
    </View>
  );

  const renderDetails = () => {
    if (!current) return null;
    const saved = goalSaved(current);
    const spent = goalSpent(current, realTransactions);
    const share = Math.min(1, saved / current.target);
    const reached = saved >= current.target;
    return (
      <>
        <Text style={styles.big}>
          {money(saved)} <Text style={styles.muted}>{t("goals.of", { target: money(current.target) })}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: reached || spent ? Colors.income : Colors.primary }]} />
        </View>
        {spent ? (
          <Text style={styles.done}>
            {t("goals.usedOn", { amount: money(spent.amount), date: spent.date.toLocaleDateString(currentLocale()) })}
          </Text>
        ) : reached ? (
          <Text style={styles.done}>{t("goals.reached")}</Text>
        ) : null}
        {held.length > 0 && (
          <Text style={styles.where}>
            {held.map((h) => t("goals.inFund", { amount: money(h.amount), fund: fundName(h.fundId) })).join(" · ")}
          </Text>
        )}

        {!spent && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => openAllocate("setAside")}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionPrimaryText}>{t("goals.setAside")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary, held.length === 0 && styles.disabled]}
              onPress={() => openAllocate("release")}
              disabled={held.length === 0}
            >
              <Ionicons name="remove" size={18} color={Colors.primary} />
              <Text style={styles.actionSecondaryText}>{t("goals.release")}</Text>
            </TouchableOpacity>
          </View>
        )}
        {!spent && <Text style={styles.hint}>{t("goals.spendHint")}</Text>}

        <Text style={styles.label}>{t("goals.history")}</Text>
        {current.allocations.length === 0 ? (
          <Text style={styles.muted}>{t("goals.noHistory")}</Text>
        ) : (
          [...current.allocations]
            .sort((a, b) => b.date - a.date)
            .map((a) => (
              <View key={a.id} style={styles.historyRow}>
                <Text style={[styles.historyAmount, { color: a.amount > 0 ? Colors.income : Colors.expense }]}>
                  {a.amount > 0 ? "+" : "−"}
                  {money(Math.abs(a.amount))}
                </Text>
                <Text style={styles.historyInfo} numberOfLines={1}>
                  {fundName(a.fundId)} · {new Date(a.date).toLocaleDateString(currentLocale())}
                </Text>
                <TouchableOpacity onPress={() => removeAllocation(a.id)} hitSlop={8} accessibilityLabel={t("common.delete")}>
                  <Ionicons name="close" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
        )}
      </>
    );
  };

  const renderAllocate = () => {
    const releasing = view === "release";
    const choices = releasing ? held.map((h) => h.fundId) : funds.map((f) => f.id);
    return (
      <>
        <Text style={styles.label}>{t("goals.amount")}</Text>
        {amountField}
        <Text style={styles.label}>{releasing ? t("goals.releaseFrom") : t("goals.setAsideFrom")}</Text>
        <View style={styles.chips}>
          {choices.map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.chip, fundId === id && styles.chipActive]}
              onPress={() => {
                setFundId(id);
                if (releasing) setAmount(String(heldIn(id)));
              }}
            >
              <Text style={[styles.chipText, fundId === id && styles.chipTextActive]}>{fundName(id)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {fundId && (
          <Text style={[styles.hint, releaseTooMuch && { color: Colors.expense }]}>
            {releasing
              ? t("goals.heldHere", { amount: money(heldIn(fundId)) })
              : amountValue > freeIn(fundId)
                ? t("goals.moreThanFree", { amount: money(freeIn(fundId)) })
                : t("goals.freeHere", { amount: money(freeIn(fundId)) })}
          </Text>
        )}
        <Text style={styles.hint}>{t("goals.setAsideNote")}</Text>
        <View style={styles.formActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setView("details")}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, !canAllocate && styles.disabled]} onPress={saveAllocation} disabled={!canAllocate}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{releasing ? t("goals.release") : t("goals.setAside")}</Text>}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderForm = () => (
    <>
      <Text style={styles.label}>{t("goals.name")}</Text>
      <View style={styles.fieldContainer}>
        <FieldIcon name="flag-outline" />
        <TextInput
          style={styles.fieldInput}
          placeholder={t("goals.namePlaceholder")}
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      </View>
      <Text style={styles.label}>{t("goals.target")}</Text>
      {amountField}
      {!current && <Text style={styles.hint}>{t("goals.newHint")}</Text>}
      <View style={styles.formActions}>
        {current && (
          <TouchableOpacity style={styles.deleteBtn} onPress={removeGoal} accessibilityLabel={t("common.delete")}>
            <Ionicons name="trash-outline" size={16} color={Colors.expense} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => (current ? setView("details") : onClose())}>
          <Text style={styles.cancelText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, !canSaveForm && styles.disabled]} onPress={saveForm} disabled={!canSaveForm}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{current ? t("addTx.saveChanges") : t("goals.create")}</Text>}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          pointerEvents="box-none"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <Ionicons name="flag-outline" size={20} color={Colors.primary} />
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              {view === "details" && current && (
                <TouchableOpacity onPress={() => setView("form")} hitSlop={8} style={styles.editBtn} accessibilityLabel={t("goals.edit")}>
                  <Ionicons name="pencil" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              <ModalCloseButton onPress={onClose} />
            </View>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.body}>
                {view === "details" ? renderDetails() : view === "form" ? renderForm() : renderAllocate()}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    root: { flex: 1 },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
    keyboardAvoider: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
    sheet: {
      width: "100%",
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: "center",
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    title: { flexShrink: 1, fontSize: FONT.title, fontWeight: "600", color: Colors.textPrimary },
    editBtn: { padding: 6 },
    scroll: { flexShrink: 1 },
    body: { paddingHorizontal: 16, gap: 8 },
    big: { fontSize: FONT.heading, fontWeight: "700", color: Colors.textPrimary },
    muted: { fontSize: FONT.small, fontWeight: "400", color: Colors.textMuted },
    track: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 4 },
    done: { fontSize: FONT.small, fontWeight: "600", color: Colors.income },
    where: { fontSize: FONT.small, color: Colors.textSecondary },
    actions: { flexDirection: "row", gap: 10, marginTop: 8 },
    actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
    actionPrimary: { backgroundColor: Colors.primary },
    actionPrimaryText: { fontSize: FONT.body, fontWeight: "600", color: "#fff" },
    actionSecondary: { backgroundColor: Colors.surfaceSecondary, borderWidth: 0.5, borderColor: Colors.border },
    actionSecondaryText: { fontSize: FONT.body, fontWeight: "600", color: Colors.primary },
    hint: { fontSize: FONT.small, color: Colors.textMuted },
    label: {
      fontSize: FONT.label,
      fontWeight: "500",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 12,
    },
    historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    historyAmount: { fontSize: FONT.body, fontWeight: "600", fontVariant: ["tabular-nums"] },
    historyInfo: { flex: 1, fontSize: FONT.small, color: Colors.textSecondary },
    fieldContainer: {
      flexDirection: "row",
      alignItems: "center",
      ...FIELD_BOX,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: Colors.border,
      gap: 8,
    },
    fieldInput: { ...FIELD_INPUT, color: Colors.textPrimary },
    suffix: { fontSize: FONT.body, color: Colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: Colors.surfaceSecondary,
      borderWidth: 0.5,
      borderColor: Colors.border,
    },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { fontSize: FONT.body, color: Colors.textPrimary },
    chipTextActive: { color: "#fff" },
    formActions: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
    deleteBtn: {
      width: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.expense + "15",
      borderWidth: 0.5,
      borderColor: Colors.expense + "40",
    },
    cancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: Colors.surfaceSecondary,
      borderWidth: 0.5,
      borderColor: Colors.border,
    },
    cancelText: { fontSize: FONT.body, fontWeight: "500", color: Colors.textSecondary },
    saveBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: "center", backgroundColor: Colors.primary },
    saveText: { fontSize: FONT.body, fontWeight: "600", color: "#fff" },
    disabled: { opacity: 0.5 },
  });
}
