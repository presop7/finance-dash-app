import { useEffect, useState } from "react";
import { isAppleMobileWeb, isPhoneBrowserTab } from "../utils/webPlatform";
import { useTranslation } from "react-i18next";
import TipCard from "./TipCard";

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
// home screen, where it opens full screen like an app. Shown on every visit
// (closing it hides it until the app is next opened) — never in the phone
// apps, the installed home-screen app, or on a computer.
export default function InstallTip() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(isPhoneBrowserTab);
  const [canPrompt, setCanPrompt] = useState(installPrompt !== null);

  useEffect(() => {
    const update = () => setCanPrompt(installPrompt !== null);
    promptListeners.add(update);
    return () => {
      promptListeners.delete(update);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    const event = installPrompt;
    if (!event) return;
    installPrompt = null; // a prompt can only be shown once
    setCanPrompt(false);
    await event.prompt().catch(() => {});
  };

  return (
    <TipCard
      icon="download-outline"
      title={t("installTip.title")}
      text={canPrompt ? t("installTip.oneTap") : isAppleMobileWeb ? t("installTip.iphone") : t("installTip.android")}
      action={canPrompt ? t("installTip.install") : undefined}
      onAction={install}
      onClose={() => setVisible(false)}
    />
  );
}
