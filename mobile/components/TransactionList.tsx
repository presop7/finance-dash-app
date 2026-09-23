import { memo, useMemo } from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme } from "../hooks/useThemeColors";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import { Category } from "../constants/categories";
import { themedCategoryColor } from "../utils/color";

export type { Transaction };

export type CategoryDetails = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  // Solid (non-translucent) border for the icon square — bg is a low-opacity
  // tint of a user-chosen category color, which on a dark surface can blend
  // into the page enough that the square itself is hard to make out; the
  // border is what actually defines its edge.
  border: string;
  label: string;
};

// Sentinel key holding the theme-resolved fallback entry (see
// useCategoryDetailsMap below) — Colors is no longer a static module-scope
// value, so the fallback has to be computed per-theme alongside the rest of
// the map rather than declared once here.
const FALLBACK_KEY = "__fallback__";

function fallbackDetails(Colors: ColorsType): Omit<CategoryDetails, "label"> {
  return {
    icon: "ellipsis-horizontal-outline",
    color: Colors.textSecondary,
    bg: Colors.surfaceSecondary,
    border: Colors.border,
  };
}

function toDetails(category: Category, Colors: ColorsType, isDark: boolean): CategoryDetails {
  const rawColor = category.color ?? Colors.primary;
  const color = themedCategoryColor(category.color, Colors.primary, isDark);
  return {
    icon: category.icon as keyof typeof Ionicons.glyphMap,
    color,
    bg: category.color ? category.color + "22" : Colors.surfaceSecondary,
    border: category.color ? rawColor + "80" : Colors.border,
    label: category.label,
  };
}

// Exported so screens that need their own FlatList (Analytics, with
// potentially hundreds of rows — see below) can share the same lookup and
// row rendering instead of duplicating it.
export function useCategoryDetailsMap(): Map<string, CategoryDetails> {
  const { expenseCategories, incomeCategories } = useFinanceStore();
  const Colors = useThemeColors();
  const isDark = useResolvedScheme() === "dark";
  return useMemo(() => {
    const map = new Map<string, CategoryDetails>();
    for (const c of expenseCategories) map.set(`expense:${c.id}`, toDetails(c, Colors, isDark));
    for (const c of incomeCategories) map.set(`income:${c.id}`, toDetails(c, Colors, isDark));
    map.set(FALLBACK_KEY, { ...fallbackDetails(Colors), label: "" });
    return map;
  }, [expenseCategories, incomeCategories, Colors, isDark]);
}

export function getTransactionDetails(
  detailsById: Map<string, CategoryDetails>,
  transaction: Transaction,
): CategoryDetails {
  return (
    detailsById.get(`${transaction.type}:${transaction.category}`) ?? {
      ...(detailsById.get(FALLBACK_KEY) ?? {
        icon: "ellipsis-horizontal-outline",
        color: "#9CA3AF",
        bg: "#F3F4F6",
        border: "#E5E7EB",
      }),
      label: transaction.category,
    }
  );
}

export function TransactionEmptyState() {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
      <Text style={styles.emptyText}>No transactions yet</Text>
      <Text style={styles.emptySubtext}>
        Tap the + button to add your first one
      </Text>
    </View>
  );
}

// The list can run into the hundreds of rows, so each row needs to be able
// to skip re-rendering when something unrelated elsewhere causes the list
// itself to re-render — without this, every keystroke or store update
// anywhere in the app re-renders every single row regardless of whether its
// own data changed.
export const TransactionRow = memo(function TransactionRow({
  transaction,
  details,
  onPress,
  onLongPress,
  isLast,
  style,
  selectMode,
  selected,
}: {
  transaction: Transaction;
  details: CategoryDetails;
  onPress?: (transaction: Transaction) => void;
  // Analytics' own multi-select — a long press enters select mode (see
  // SwipeableTransactionRow), a plain TouchableOpacity already supports this
  // natively without needing a separate hold-gesture component.
  onLongPress?: () => void;
  // Drops the divider line under the very last row of a card-styled list.
  isLast?: boolean;
  // Merged on top of the default row style — lets a caller building its own
  // card look (e.g. rounding just the first/last row) override it directly.
  style?: StyleProp<ViewStyle>;
  // Both optional — only Analytics' select mode passes these.
  selectMode?: boolean;
  selected?: boolean;
}) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const date = new Date(transaction.date);
  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast, style]}
      onPress={() => onPress?.(transaction)}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {selectMode && (
        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={20}
          color={selected ? Colors.primary : Colors.textMuted}
          style={styles.selectIcon}
        />
      )}

      {/* Category Icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: details.bg, borderColor: details.border },
        ]}
      >
        <Ionicons name={details.icon} size={18} color={details.color} />
      </View>

      {/* Title and Category */}
      <View style={styles.info}>
        <Text style={styles.transactionTitle} numberOfLines={1}>
          {transaction.title || details.label}
        </Text>
        <Text style={styles.category}>
          {details.label} · {formattedDate}
        </Text>
        {transaction.isPending ? (
          <View style={styles.noteHint}>
            <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
            <Text style={styles.noteHintText}>Waiting to sync</Text>
          </View>
        ) : null}
        {transaction.note ? (
          <View style={styles.noteHint}>
            <Ionicons
              name="document-text-outline"
              size={10}
              color={Colors.textMuted}
            />
            <Text style={styles.noteHintText}>Open to read note</Text>
          </View>
        ) : null}
      </View>

      {/* Amount */}
      <Text
        style={[
          styles.amount,
          transaction.type === "income" ? styles.incomeAmount : styles.expenseAmount,
        ]}
      >
        {transaction.type === "income" ? "+" : "-"}
        {transaction.amount.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
});

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  selectIcon: {
    marginRight: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  category: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  noteHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  noteHintText: {
    fontSize: 10,
    fontStyle: "italic",
    color: Colors.textMuted,
  },
  amount: {
    fontSize: 13,
    fontWeight: "500",
  },
  incomeAmount: {
    color: Colors.income,
  },
  expenseAmount: {
    color: Colors.expense,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  });
}
