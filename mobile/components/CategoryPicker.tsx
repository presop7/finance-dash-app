import { RefObject, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ColorsType } from "../constants/colors";
import { FIELD_BOX, FIELD_INPUT } from "../constants/styles";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { Category } from "../constants/categories";
import { themedCategoryColor } from "../utils/color";
import { useStagedCount } from "../hooks/useStagedCount";
import { ReorderItem, useReorder } from "./Reorderable";
import { useFinanceStore } from "../store/useFinanceStore";
import { sortByOrder } from "../utils/reorder";
import { useTranslation } from "react-i18next";
import FieldIcon from "./FieldIcon";
import { FONT } from "../constants/typography";

type CategoryPickerProps = {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
  // Holding a chip and letting go opens it for editing in the category
  // manager, instead of needing to go there via "+New" and find it again.
  // Holding and moving it reorders the chips instead.
  onHoldEdit: (id: string) => void;
  // Lets a caller (the transaction form) focus the search box
  // programmatically — e.g. chaining the title/amount fields' keyboard
  // "next" action into it, so filling out a new transaction doesn't need
  // switching to the touchscreen between fields.
  searchInputRef?: RefObject<TextInput | null>;
};

export default function CategoryPicker({
  categories,
  selected,
  onSelect,
  onHoldEdit,
  searchInputRef,
}: CategoryPickerProps) {
  const [search, setSearch] = useState("");
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";
  const categoryOrder = useFinanceStore((s) => s.categoryOrder);
  const setCategoryOrder = useFinanceStore((s) => s.setCategoryOrder);
  const trimmed = search.trim().toLowerCase();
  const sorted = sortByOrder(categories, categoryOrder);
  const filtered = trimmed
    ? sorted.filter((c) => c.label.toLowerCase().includes(trimmed))
    : sorted;
  // Reordering only with the full list showing, not a search's few.
  const reorder = useReorder(filtered.map((c) => c.id), setCategoryOrder, !trimmed);
  const byId = new Map(filtered.map((c) => [c.id, c]));
  // Only ~5 chips fit on screen at once — mount the first batch immediately
  // and the rest a beat later rather than all of them in one heavy pass.
  const visibleCount = useStagedCount(filtered.length, 8);

  // Jumps the strip to the selected chip whenever the selection changes
  // from outside a direct tap here — e.g. returning from the category
  // manager after picking one there, which could be scrolled off-screen.
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const x = reorder.rects.get(selected)?.x;
    if (x !== undefined) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }
  }, [selected]);

  return (
    <View>
      {/* Scrolling through everything gets unwieldy once there are more than
          a handful of categories — searching narrows it down directly. */}
      <View style={styles.searchBox}>
        <FieldIcon name="search-outline" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t("pickers.searchCategories")}
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t("pickers.noMatch", { query: search.trim() })}</Text>
        ) : (
          reorder.order.slice(0, visibleCount).map((id) => {
            const category = byId.get(id)!;
            const isSelected = category.id === selected;
            const colorKey = category.id as keyof typeof Colors.categories;
            const colors = Colors.categories[colorKey] ?? Colors.categories.other;
            const iconColor = themedCategoryColor(category.color, colors.icon, isDark);
            const bgColor = category.color ? category.color + "22" : colors.bg;

            return (
              <ReorderItem
                key={category.id}
                id={category.id}
                reorder={reorder}
                style={styles.item}
                onPress={() => onSelect(category.id)}
                onHold={() => onHoldEdit(category.id)}
              >
                {(fillStyle) => (
                  <>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: bgColor },
                        isSelected && {
                          borderWidth: 2,
                          borderColor: iconColor,
                        },
                      ]}
                    >
                      {/* Confines the hold-fill to just this square instead
                          of the whole chip (icon + label below it). */}
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.iconFill, fillStyle]}
                      />
                      <Ionicons
                        name={category.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={iconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.label,
                        isSelected && { color: iconColor, fontWeight: "600" },
                      ]}
                    >
                      {category.label}
                    </Text>
                  </>
                )}
              </ReorderItem>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    ...FIELD_BOX,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchInput: { ...FIELD_INPUT, color: Colors.textPrimary },
  emptyText: {
    fontSize: FONT.small,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
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
  });
}
