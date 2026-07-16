import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";

export default function AnalysisScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Analytics — Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    color: Colors.textMuted,
  },
});
