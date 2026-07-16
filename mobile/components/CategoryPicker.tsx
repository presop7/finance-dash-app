import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { Category } from "../constants/categories";

type CategoryPickerProps = {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
};

// Maps category icon string to Ionicons name
const getIcon = (icon: string): keyof typeof Ionicons.glyphMap => {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    "shopping-cart": "cart-outline",
    coffee: "cafe-outline",
    car: "car-outline",
    "device-gamepad": "game-controller-outline",
    "building-bank": "business-outline",
    briefcase: "briefcase-outline",
    "chart-line": "trending-up-outline",
    dots: "ellipsis-horizontal-outline",
  };
  return map[icon] ?? "ellipsis-horizontal-outline";
};

export default function CategoryPicker({
  categories,
  selected,
  onSelect,
}: CategoryPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => {
        const isSelected = category.id === selected;
        const colorKey = category.id as keyof typeof Colors.categories;
        const colors = Colors.categories[colorKey] ?? Colors.categories.other;

        return (
          <TouchableOpacity
            key={category.id}
            style={styles.item}
            onPress={() => onSelect(category.id)}
            activeOpacity={0.7}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.bg },
                isSelected && styles.selectedIcon,
              ]}
            >
              <Ionicons
                name={getIcon(category.icon)}
                size={20}
                color={colors.icon}
              />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.label,
                isSelected && { color: colors.icon, fontWeight: "600" },
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  },
  selectedIcon: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
