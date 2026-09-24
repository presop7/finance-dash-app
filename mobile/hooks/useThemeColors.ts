import { createContext, createElement, ReactNode, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useFinanceStore } from "../store/useFinanceStore";
import { ColorsType, lightColors, darkColors } from "../constants/colors";

type ThemeValue = { scheme: "light" | "dark"; colors: ColorsType };

const ThemeContext = createContext<ThemeValue>({ scheme: "light", colors: lightColors });

// The only place that listens to the theme preference and the OS appearance.
// Every component that used to subscribe to both on its own (hundreds of
// chips/rows/buttons mounting at once) now just reads this context, which
// costs nothing to mount — and still re-renders them all on an actual theme
// change. "system" follows the OS (useColorScheme, built into
// react-native); light/dark are explicit overrides. Falls back to "light" if
// the OS can't report a scheme (some Android/web contexts return null).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useFinanceStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  const scheme: "light" | "dark" =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  const value = useMemo(
    () => ({ scheme, colors: scheme === "dark" ? darkColors : lightColors }),
    [scheme],
  );
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useResolvedScheme(): "light" | "dark" {
  return useContext(ThemeContext).scheme;
}

export function useThemeColors(): ColorsType {
  return useContext(ThemeContext).colors;
}

// One built stylesheet per (factory, palette), shared by every instance —
// previously each mounted component instance ran its own StyleSheet.create,
// so a screen mounting a hundred chips built a hundred identical sheets.
// Palettes are module-level singletons, so a WeakMap keyed on them is safe.
const styleCache = new WeakMap<object, WeakMap<ColorsType, unknown>>();

export function getThemedStyles<T extends object>(
  factory: (colors: ColorsType) => T,
  colors: ColorsType,
): T {
  let perPalette = styleCache.get(factory);
  if (!perPalette) {
    perPalette = new WeakMap();
    styleCache.set(factory, perPalette);
  }
  let styles = perPalette.get(colors) as T | undefined;
  if (!styles) {
    styles = factory(colors);
    perPalette.set(colors, styles);
  }
  return styles;
}
