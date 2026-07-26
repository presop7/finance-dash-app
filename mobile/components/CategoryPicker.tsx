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

        // Use category.color if it exists (custom categories)
        // otherwise fall back to Colors.categories map (default categories)
        const iconColor = category.color ?? colors.icon;
        const bgColor = category.color ? category.color + "22" : colors.bg;

        return (
          <TouchableOpacity
            key={category.id}
            style={styles.item}
            onPress={() => onSelect(category.id)}
            activeOpacity={0.7}
          >
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
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
