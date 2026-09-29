import { StyleProp, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

// The icon at the start of a text field. Every one sits in the same fixed
// slot at the same size, so the text in every field starts at the same
// place whichever icon it has.
export default function FieldIcon({
  name,
  color,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useThemeColors();
  return (
    <View style={[{ width: 22, alignItems: "center" }, style]}>
      <Ionicons name={name} size={18} color={color ?? Colors.textMuted} />
    </View>
  );
}
