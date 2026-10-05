import { useEffect, useState } from "react";
import {
  isAppleMobileWeb,
  isBrowserTab,
  isDesktopFirefox,
  isDesktopWeb,
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
    promptListeners.forEach((fn) => fn());
  });
}

// Web version opened in a browser tab: suggests installing it — on a phone to
// the home screen (opens full screen like an app), on a computer as an app in
// its own window (Start menu, taskbar, Dock). Every visit; never in the phone
// apps or once it's installed. A one-tap Install button wherever the browser
// offers its prompt; otherwise that browser's own steps. iPhones/iPads never
// offer it (Share → Add to Home Screen is the only way), and Firefox on a
// computer can't install web apps, so it gets no tip.
export function useInstallTip(): Tip | null {
  const { t } = useTranslation();
  const [canPrompt, setCanPrompt] = useState(installPrompt !== null);

  useEffect(() => {
    const update = () => setCanPrompt(installPrompt !== null);
    promptListeners.add(update);
    return () => {
      promptListeners.delete(update);
    };
  }, []);

  if (!isBrowserTab) return null;
  if (isDesktopWeb && !canPrompt && isDesktopFirefox) return null;
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
