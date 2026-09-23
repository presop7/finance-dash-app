import { useColorScheme } from "react-native";
import { useFinanceStore } from "../store/useFinanceStore";
import { ColorsType, lightColors, darkColors } from "../constants/colors";

// "system" follows the OS appearance (useColorScheme, built into
// react-native — no extra dependency); light/dark are explicit overrides.
// Falls back to "light" if the OS can't report a scheme (some Android/web
// contexts return null).
export function useResolvedScheme(): "light" | "dark" {
  const preference = useFinanceStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  if (preference === "system") return systemScheme === "dark" ? "dark" : "light";
  return preference;
}

export function useThemeColors(): ColorsType {
  return useResolvedScheme() === "dark" ? darkColors : lightColors;
}
