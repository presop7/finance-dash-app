import { useEffect, useState } from "react";
import {
  isAndroidChrome,
  isAndroidWeb,
  isAppleMobileWeb,
  isBrowserTab,
  isDesktopFirefox,
  isDesktopWeb,
  isInstalledWebApp,
  isMacSafari,
} from "../utils/webPlatform";
import { useTranslation } from "react-i18next";
import type { Tip } from "./FloatingTips";

// Chromium browsers — Chrome, Brave, Edge, Samsung Internet, on Android and on
// computers — offer their own install prompt to a site that asks for it. The
// event fires early — often before this component mounts — so it's caught
// here, at import, and kept.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
let installPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (isBrowserTab) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // shown from our tip's button instead
    installPrompt = event as InstallPromptEvent;
    // Browsers only offer to install what isn't installed: an earlier
    // install note is out of date (the app was removed since).
    installed = false;
    try {
      localStorage.removeItem(INSTALLED_KEY);
    } catch {}
    promptListeners.forEach((fn) => fn());
  });
}

// Already installed? A browser tab can't open the installed app, but it can
// say to use it instead of nagging to install it again. Two ways to know:
//   - getInstalledRelatedApps (Chromium; needs related_applications in
//     manifest.json) asks the browser itself.
//   - Where that isn't available (e.g. some Brave versions): a note the
//     installed app leaves on every start, and the "appinstalled" event. On
//     Android the installed app shares the browser's storage, so the browser
//     tab sees the note — it just takes opening the installed app once.
const INSTALLED_KEY = "fi-track-installed";
const remember = () => {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {}
};
let installed = false;
if (isInstalledWebApp) remember();
if (isBrowserTab) {
  try {
    installed = localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {}
  window.addEventListener("appinstalled", () => {
    remember();
    installed = true;
    promptListeners.forEach((fn) => fn());
  });
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  // Only a "yes" is trusted: some browsers have the call but always answer
  // "none". Uninstalling is caught by the install offer instead (above).
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length === 0) return;
      remember();
      installed = true;
      promptListeners.forEach((fn) => fn());
    })
    .catch(() => {});
}

// Web version opened in a browser tab: suggests installing it — on a phone to
// the home screen (opens full screen like an app), on a computer as an app in
// its own window (Start menu, taskbar, Dock). Every visit; never in the phone
// apps or once it's installed. A one-tap Install button wherever the browser
// offers its prompt; otherwise that browser's own steps. iPhones/iPads never
// offer it (Share → Add to Home Screen is the only way), and Firefox on a
// computer can't install web apps, so it's pointed to Chrome or Edge.
export function useInstallTip(): Tip | null {
  const { t } = useTranslation();
  const [canPrompt, setCanPrompt] = useState(installPrompt !== null);
  const [isInstalled, setIsInstalled] = useState(installed);

  useEffect(() => {
    const update = () => {
      setCanPrompt(installPrompt !== null);
      setIsInstalled(installed);
    };
    promptListeners.add(update);
    return () => {
      promptListeners.delete(update);
    };
  }, []);

  if (!isBrowserTab) return null;
  if (isInstalled) {
    return { id: "install", icon: "open-outline", title: t("installTip.installedTitle"), text: t("installTip.installed") };
  }
  // Android, but not Chrome: only Chrome installs it as a real app, so send
  // the user there — Android opens this same page straight in Chrome (or,
  // without Chrome, Chrome's Play Store page).
  if (isAndroidWeb && !isAndroidChrome) {
    return {
      id: "install",
      icon: "logo-chrome",
      title: t("installTip.chromeTitle"),
      text: t("installTip.chrome"),
      action: t("installTip.openInChrome"),
      onAction: () => {
        const fallback = encodeURIComponent("https://play.google.com/store/apps/details?id=com.android.chrome");
        window.location.href =
          `intent://${window.location.host}${window.location.pathname}` +
          `#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
      },
    };
  }
  // Firefox on a computer can't install web apps: suggest a browser that can.
  if (isDesktopWeb && !canPrompt && isDesktopFirefox) {
    return { id: "install", icon: "browsers-outline", title: t("installTip.firefoxTitle"), text: t("installTip.firefox") };
  }
  const text = canPrompt
    ? isDesktopWeb
      ? t("installTip.oneTapDesktop")
      : t("installTip.oneTap")
    : isDesktopWeb
      ? isMacSafari
        ? t("installTip.macSafari")
        : t("installTip.desktop")
      : isAppleMobileWeb
        ? t("installTip.iphone")
        : t("installTip.android");
  return {
    id: "install",
    icon: "download-outline",
    title: t("installTip.title"),
    text,
    action: canPrompt ? t("installTip.install") : undefined,
    onAction: async () => {
      const event = installPrompt;
      if (!event) return;
      installPrompt = null; // a prompt can only be shown once
      setCanPrompt(false);
      await event.prompt().catch(() => {});
    },
  };
}
