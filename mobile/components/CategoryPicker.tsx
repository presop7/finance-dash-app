import { RefObject, useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { Category } from "../constants/categories";
import HoldPressable from "./HoldPressable";

type CategoryPickerProps = {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
  // Holding a chip opens it for editing in the category manager, instead of
  // needing to go there via "+New" and find it again.
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
  const trimmed = search.trim().toLowerCase();
  const filtered = trimmed
    ? categories.filter((c) => c.label.toLowerCase().includes(trimmed))
    : categories;

  // Jumps the strip to the selected chip whenever the selection changes
  // from outside a direct tap here — e.g. returning from the category
  // manager after picking one there, which could be scrolled off-screen.
  const scrollRef = useRef<ScrollView>(null);
  const itemOffsetsRef = useRef(new Map<string, number>());

  useEffect(() => {
    const x = itemOffsetsRef.current.get(selected);
    if (x !== undefined) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }
  }, [selected]);

  return (
    <View>
      {/* Scrolling through everything gets unwieldy once there are more than
          a handful of categories — searching narrows it down directly. */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories"
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
          <Text style={styles.emptyText}>No categories match "{search.trim()}"</Text>
        ) : (
          filtered.map((category) => {
            const isSelected = category.id === selected;
            const colorKey = category.id as keyof typeof Colors.categories;
            const colors = Colors.categories[colorKey] ?? Colors.categories.other;
            const iconColor = category.color ?? colors.icon;
            const bgColor = category.color ? category.color + "22" : colors.bg;

            return (
              <HoldPressable
                key={category.id}
                style={styles.item}
                onPress={() => onSelect(category.id)}
                onHoldComplete={() => onHoldEdit(category.id)}
                onLayout={(e) => itemOffsetsRef.current.set(category.id, e.nativeEvent.layout.x)}
              >
                {(fillWidth) => (
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
                        style={[styles.iconFill, { width: fillWidth }]}
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
              </HoldPressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, padding: 0 },
  emptyText: {
    fontSize: 12,
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
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
