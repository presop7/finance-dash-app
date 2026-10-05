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

// The web version in a normal browser tab (not yet installed as an app).
export const isBrowserTab = isWeb && !isInstalledWebApp;

// A phone or tablet using the web version in a normal browser tab.
export const isPhoneBrowserTab = isBrowserTab && !isDesktopWeb;

const userAgent = isWeb ? window.navigator.userAgent : "";
// Firefox on a computer can't install web apps at all.
export const isDesktopFirefox = isDesktopWeb && /Firefox\//.test(userAgent);
// Safari on a Mac: no install prompt, but File → Add to Dock (Safari 17+).
export const isMacSafari =
  isDesktopWeb && /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(userAgent);

// iPhone/iPad (recent iPads report as a Mac, but with a touchscreen).
export const isAppleMobileWeb =
  isWeb &&
  (/iPhone|iPad|iPod/.test(window.navigator.userAgent) ||
    (/Macintosh/.test(window.navigator.userAgent) && window.navigator.maxTouchPoints > 1));

// iPhone/iPad web push needs iOS 16.4+ (and the Home Screen app). Older ones
// can't get notifications at all, installed or not. iPads that report as a
// Mac carry no iOS version: recent enough to count as supported.
const iosVersion = isWeb ? /OS (\d+)_(\d+)/.exec(window.navigator.userAgent) : null;
export const isAppleTooOldForPush =
  isAppleMobileWeb && !!iosVersion && Number(iosVersion[1]) * 100 + Number(iosVersion[2]) < 1604;
