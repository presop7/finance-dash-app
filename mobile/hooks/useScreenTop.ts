import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Space above each screen's title. The phone apps keep their fixed 60, which
// clears the status bar. The web version has no status bar in a browser, so
// it uses the real top inset (only the installed iPhone web app has one)
// instead of a 60px empty gap.
export function useScreenTop(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "web" ? insets.top + 16 : 60;
}
