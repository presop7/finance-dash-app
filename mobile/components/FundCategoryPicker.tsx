import { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { FundCategory } from "../constants/fundCategories";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { themedCategoryColor } from "../utils/color";
import { ReorderItem, useReorder } from "./Reorderable";
import { useFinanceStore } from "../store/useFinanceStore";
import { sortByOrder } from "../utils/reorder";
import { FONT } from "../constants/typography";

type FundCategoryPickerProps = {
  fundCategories: FundCategory[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  // Holding a chip and letting go opens it for editing in the category
  // manager, instead of needing to go there via "+New" and find it again.
  // Holding and moving it reorders the funds (the same order as the
  // Dashboard's savings cards).
  onHoldEdit: (id: string) => void;
};

export default function FundCategoryPicker({
  fundCategories,
  selected,
  onSelect,
  onHoldEdit,
  // onAdd,
}: FundCategoryPickerProps) {
  // Jumps the strip to the selected chip whenever the selection changes
  // from outside a direct tap here — e.g. returning from the category
  // manager after picking one there, which could be scrolled off-screen.
  const scrollRef = useRef<ScrollView>(null);
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";
  const fundCardOrder = useFinanceStore((s) => s.fundCardOrder);
  const setFundCardOrder = useFinanceStore((s) => s.setFundCardOrder);
  const sorted = sortByOrder(fundCategories, fundCardOrder);
  const reorder = useReorder(sorted.map((f) => f.id), setFundCardOrder);
  const byId = new Map(sorted.map((f) => [f.id, f]));

  useEffect(() => {
    const x = reorder.rects.get(selected)?.x;
    if (x !== undefined) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }
  }, [selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {reorder.order.map((id) => {
        const item = byId.get(id)!;
        const isSelected = item.id === selected;
        const iconColor = themedCategoryColor(item.color, Colors.primary, isDark);

        return (
          <ReorderItem
            key={item.id}
            id={item.id}
            reorder={reorder}
            style={styles.item}
            onPress={() => onSelect(item.id)}
            onHold={() => onHoldEdit(item.id)}
          >
            {(fillStyle) => (
              <>
                {/* Icon */}
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: item.color + "22" },
                    isSelected && {
                      borderWidth: 2,
                      borderColor: iconColor,
                    },
                  ]}
                >
                  {/* Confines the hold-fill to just this square instead of
                      the whole chip (icon + label below it). */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.iconFill, fillStyle]}
                  />
                  <Ionicons
                    name={item.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={iconColor}
                  />
                </View>

                {/* Label */}
                <Text
                  style={[
                    styles.label,
                    isSelected && { color: iconColor, fontWeight: "600" },
                  ]}
                >
                  {item.name}
                </Text>
              </>
            )}
          </ReorderItem>
        );
      })}

      {/* Add new fund category button */}
      {/* <TouchableOpacity style={styles.item} onPress={onAdd} activeOpacity={0.7}>
        <View style={[styles.iconContainer, styles.addContainer]}>
          <Ionicons name="add" size={20} color={Colors.textMuted} />
        </View>
        <Text style={styles.addLabel}>New</Text>
      </TouchableOpacity> */}
    </ScrollView>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  item: {
    alignItems: "center",
    gap: 6,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  iconFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary + "22",
  },
  label: {
    fontSize: FONT.small,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  addContainer: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  addLabel: {
    fontSize: FONT.label,
    color: Colors.textMuted,
  },
  });
}
