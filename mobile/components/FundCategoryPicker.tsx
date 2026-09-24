import { useEffect, useRef } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FundCategory } from "../constants/fundCategories";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { themedCategoryColor } from "../utils/color";
import HoldPressable from "./HoldPressable";

type FundCategoryPickerProps = {
  fundCategories: FundCategory[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  // Holding a chip opens it for editing in the category manager, instead of
  // needing to go there via "+New" and find it again.
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
  const itemOffsetsRef = useRef(new Map<string, number>());
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const isDark = useResolvedScheme() === "dark";

  useEffect(() => {
    const x = itemOffsetsRef.current.get(selected);
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
      {fundCategories.map((item) => {
        const isSelected = item.id === selected;
        const iconColor = themedCategoryColor(item.color, Colors.primary, isDark);

        return (
          <HoldPressable
            key={item.id}
            style={styles.item}
            onPress={() => onSelect(item.id)}
            onHoldComplete={() => onHoldEdit(item.id)}
            onLayout={(e) => itemOffsetsRef.current.set(item.id, e.nativeEvent.layout.x)}
          >
            {(fillWidth) => (
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
                    style={[styles.iconFill, { width: fillWidth }]}
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
          </HoldPressable>
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
    fontSize: 10,
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
    fontSize: 10,
    color: Colors.textMuted,
  },
  });
}
