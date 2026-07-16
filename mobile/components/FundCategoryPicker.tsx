import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FundCategory } from "../constants/fundCategories";
import { Colors } from "../constants/colors";

type FundCategoryPickerProps = {
  fundCategories: FundCategory[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
};

export default function FundCategoryPicker({
  fundCategories,
  selected,
  onSelect,
  // onAdd,
}: FundCategoryPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {fundCategories.map((item) => {
        const isSelected = item.id === selected;

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.7}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: item.color + "22" },
                isSelected && {
                  borderWidth: 2,
                  borderColor: item.color,
                },
              ]}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={item.color}
              />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.label,
                isSelected && { color: item.color, fontWeight: "600" },
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
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
