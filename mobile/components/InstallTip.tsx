import { useEffect, useState } from "react";
import { isAppleMobileWeb, isPhoneBrowserTab } from "../utils/webPlatform";
import { useTranslation } from "react-i18next";
import type { Tip } from "./FloatingTips";

// Android browsers (Chrome, Brave, Samsung Internet, Edge) offer their own
// install prompt to a site that asks for it. The event fires early — often
// before this component mounts — so it's caught here, at import, and kept.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
let installPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (isPhoneBrowserTab) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // shown from our tip's button instead
    installPrompt = event as InstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
}

// Web version opened in a phone's browser tab: suggests installing it to the
// home screen, where it opens full screen like an app. Every visit — never in
// the phone apps, the installed home-screen app, or on a computer.
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

  if (!isPhoneBrowserTab) return null;
  return {
    id: "install",
    icon: "download-outline",
    title: t("installTip.title"),
    text: canPrompt ? t("installTip.oneTap") : isAppleMobileWeb ? t("installTip.iphone") : t("installTip.android"),
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
