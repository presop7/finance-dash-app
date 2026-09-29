import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../../constants/colors";
import { FIELD_BOX, FIELD_INPUT } from "../../constants/styles";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore, AlertRule, AlertRuleType } from "../../store/useFinanceStore";
import { confirmAsync } from "../../utils/confirm";
import ModalCloseButton from "../../components/ModalCloseButton";
import { CONTENT_MAX_WIDTH } from "../../constants/layout";
import { useTranslation } from "react-i18next";

const pad2 = (n: number) => n.toString().padStart(2, "0");

const TYPE_ICONS: Record<AlertRuleType, keyof typeof Ionicons.glyphMap> = {
  lowBalance: "trending-down-outline",
  balanceAbove: "trending-up-outline",
  monthlyExpenseOver: "cash-outline",
  monthlyIncomeOver: "wallet-outline",
  categoryAmount: "pricetag-outline",
  dailyReminder: "alarm-outline",
};

const ALL_TYPES: AlertRuleType[] = [
  "lowBalance",
  "balanceAbove",
  "monthlyExpenseOver",
  "monthlyIncomeOver",
  "categoryAmount",
  "dailyReminder",
];

type AlertRuleModalProps = {
  visible: boolean;
  editingRule: AlertRule | null;
  onClose: () => void;
};

export default function AlertRuleModal({
  visible,
  editingRule,
  onClose,
}: AlertRuleModalProps) {
  const {
    expenseCategories,
    incomeCategories,
    addAlertRule,
    updateAlertRule,
    deleteAlertRule,
  } = useFinanceStore();
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const resolvedScheme = useResolvedScheme();

  const [type, setType] = useState<AlertRuleType>("lowBalance");
  const [amount, setAmount] = useState("");
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Held as a Date purely so DateTimePicker (mode="time") can drive it —
  // only the hour/minute components are ever read out of it.
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingRule) {
      setType(editingRule.type);
      setAmount(editingRule.amount.toString());
      setCategoryType(editingRule.categoryType ?? "expense");
      setCategoryId(editingRule.categoryId ?? null);
      if (editingRule.hour !== undefined && editingRule.minute !== undefined) {
        const d = new Date();
        d.setHours(editingRule.hour, editingRule.minute, 0, 0);
        setTime(d);
      }
    } else {
      setType("lowBalance");
      setAmount("");
      setCategoryType("expense");
      setCategoryId(null);
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      setTime(d);
    }
  }, [visible, editingRule]);

  const categories = categoryType === "expense" ? expenseCategories : incomeCategories;

  const handleSave = () => {
    if (type === "dailyReminder") {
      const changes = {
        type,
        amount: 0,
        categoryId: undefined,
        categoryType: undefined,
        hour: time.getHours(),
        minute: time.getMinutes(),
        enabled: editingRule?.enabled ?? true,
      };
      if (editingRule) {
        updateAlertRule(editingRule.id, changes);
      } else {
        addAlertRule(changes);
      }
      onClose();
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;
    if (type === "categoryAmount" && !categoryId) return;

    const changes = {
      type,
      amount: numericAmount,
      categoryId: type === "categoryAmount" ? categoryId ?? undefined : undefined,
      categoryType: type === "categoryAmount" ? categoryType : undefined,
      hour: undefined,
      minute: undefined,
      enabled: editingRule?.enabled ?? true,
    };

    if (editingRule) {
      updateAlertRule(editingRule.id, { ...changes, lastTriggeredKey: undefined });
    } else {
      addAlertRule(changes);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!editingRule) return;
    const ok = await confirmAsync(t("reminders.deleteTitle"), t("reminders.deleteConfirm"));
    if (!ok) return;
    deleteAlertRule(editingRule.id);
    onClose();
  };

  const numericAmount = parseFloat(amount);
  const canSave =
    type === "dailyReminder"
      ? true
      : !isNaN(numericAmount) &&
        numericAmount > 0 &&
        (type !== "categoryAmount" || Boolean(categoryId));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        {/* android.softwareKeyboardLayoutMode isn't set in app.json, so
            Android has no native window-resize to lean on here — "height"
            drives the push-up directly instead of assuming one exists. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{editingRule ? t("reminders.edit") : t("reminders.add")}</Text>
            <ModalCloseButton onPress={onClose} />
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <View style={styles.body}>
              <Text style={styles.formLabel}>{t("reminders.type")}</Text>
              <View style={styles.typeGrid}>
                {ALL_TYPES.map((ruleType) => (
                  <TouchableOpacity
                    key={ruleType}
                    style={[styles.typeChip, type === ruleType && styles.typeChipActive]}
                    onPress={() => setType(ruleType)}
                  >
                    <Ionicons
                      name={TYPE_ICONS[ruleType]}
                      size={16}
                      color={type === ruleType ? "#fff" : Colors.textMuted}
                    />
                    <Text style={[styles.typeChipText, type === ruleType && styles.typeChipTextActive]}>
                      {t(`reminders.types.${ruleType}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {type === "dailyReminder" ? (
                <>
                  <Text style={styles.formLabel}>{t("reminders.time")}</Text>
                  {Platform.OS === "web" ? (
                    // DateTimePicker has no web version; the browser's own time
                    // input opens the phone's clock/wheel picker instead.
                    <View style={styles.fieldContainer}>
                      <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                      <input
                        type="time"
                        value={`${pad2(time.getHours())}:${pad2(time.getMinutes())}`}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          if (Number.isNaN(h) || Number.isNaN(m)) return;
                          const d = new Date(time);
                          d.setHours(h, m, 0, 0);
                          setTime(d);
                        }}
                        style={{
                          ...FIELD_INPUT,
                          fontFamily: "inherit",
                          color: Colors.textPrimary,
                          background: "transparent",
                          border: "none",
                          colorScheme: resolvedScheme,
                        }}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.fieldContainer}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                      <Text style={styles.fieldInput}>
                        {time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      value={time}
                      mode="time"
                      display="default"
                      themeVariant={resolvedScheme}
                      onChange={(_event, selected) => {
                        setShowTimePicker(false);
                        if (selected) setTime(selected);
                      }}
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.formLabel}>{t("reminders.amount")}</Text>
                  <View style={styles.fieldContainer}>
                    <Ionicons name="pricetag-outline" size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </>
              )}

              {type === "categoryAmount" && (
                <>
                  <Text style={styles.formLabel}>{t("reminders.categoryType")}</Text>
                  <View style={styles.typeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        categoryType === "expense" && { backgroundColor: Colors.expense },
                      ]}
                      onPress={() => {
                        setCategoryType("expense");
                        setCategoryId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          categoryType === "expense" ? styles.toggleActiveText : styles.toggleInactiveText,
                        ]}
                      >
                        {t("common.expense")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        categoryType === "income" && { backgroundColor: Colors.income },
                      ]}
                      onPress={() => {
                        setCategoryType("income");
                        setCategoryId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          categoryType === "income" ? styles.toggleActiveText : styles.toggleInactiveText,
                        ]}
                      >
                        {t("common.incomeOne")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formLabel}>{t("addTx.category")}</Text>
                  <View style={styles.typeGrid}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.typeChip, categoryId === cat.id && styles.typeChipActive]}
                        onPress={() => setCategoryId(cat.id)}
                      >
                        <Ionicons
                          name={cat.icon as keyof typeof Ionicons.glyphMap}
                          size={16}
                          color={categoryId === cat.id ? "#fff" : (cat.color ?? Colors.textMuted)}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            categoryId === cat.id && styles.typeChipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.formActions}>
                {editingRule && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={16} color={Colors.expense} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  <Text style={styles.saveBtnText}>{editingRule ? t("addTx.saveChanges") : t("reminders.add")}</Text>
                </TouchableOpacity>
              </View>
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  // Deliberately not absolutely positioned: KeyboardAvoidingView's "padding"
  // behavior pushes its content up by padding *itself*, which only moves a
  // normal flow child — an absolutely-positioned bottom:0 child ignores
  // that and stays pinned to the screen edge, under the keyboard. Sitting
  // at the bottom is instead handled by keyboardAvoider's justifyContent.
  sheet: {
    // Centered and capped on wide screens (web on a computer); phones
    // are narrower than the cap, so unchanged there.
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  keyboardAvoider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
  body: { paddingHorizontal: 16 },
  formLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 12,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  typeChipTextActive: { color: "#fff" },
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
  typeToggle: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  toggleOption: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  toggleText: { fontSize: 13, fontWeight: "500" },
  toggleActiveText: { color: "#fff" },
  toggleInactiveText: { color: Colors.textMuted },
  formActions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  deleteBtn: {
    width: 44,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.expense + "15",
    borderWidth: 0.5,
    borderColor: Colors.expense + "40",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "500", color: Colors.textSecondary },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, alignItems: "center", backgroundColor: Colors.primary },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  });
}
