import { Platform } from "react-native";

// What kind of browser the web version is running in. Decided from the
// input type rather than the device name: can't be fooled by user-agent
// strings, and handles touchscreen laptops / iPads sensibly. Always false
// in the phone apps.

const isWeb = Platform.OS === "web" && typeof window !== "undefined";
const matches = (query: string) => isWeb && Boolean(window.matchMedia?.(query).matches);

// A mouse or trackpad as the main pointer, i.e. a computer.
export const isDesktopWeb = matches("(hover: hover) and (pointer: fine)");

// Opened from a home-screen icon ("Add to Home Screen" / "Install app")
// rather than as a browser tab. navigator.standalone is iPhone Safari's own
// flag for this.
export const isInstalledWebApp =
  matches("(display-mode: standalone)") ||
  (isWeb && (window.navigator as { standalone?: boolean }).standalone === true);

// A phone or tablet using the web version in a normal browser tab.
export const isPhoneBrowserTab = isWeb && !isDesktopWeb && !isInstalledWebApp;

// iPhone/iPad (recent iPads report as a Mac, but with a touchscreen).
export const isAppleMobileWeb =
  isWeb &&
  (/iPhone|iPad|iPod/.test(window.navigator.userAgent) ||
    (/Macintosh/.test(window.navigator.userAgent) && window.navigator.maxTouchPoints > 1));
